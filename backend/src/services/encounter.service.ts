import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  Encounter, 
  EncounterEntity, 
  CreateEncounterInput, 
  UpdateEncounterInput,
  CaptureConsentInput,
  EncounterStatus,
  UpdateEncounterStatusInput
} from '../types/encounter';
import { NotFoundError, BusinessLogicError } from '../errors';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

export class EncounterService {
  constructor(
    private dynamodb: DynamoDBDocumentClient,
    private tableName: string
  ) {}

  /**
   * Create a new encounter
   */
  async createEncounter(input: CreateEncounterInput, providerId: string): Promise<Encounter> {
    const encounterId = uuidv4();
    const timestamp = new Date().toISOString();
    const scheduledAt = input.scheduledAt || timestamp; // Use provided time or current time
    const scheduledDate = scheduledAt.split('T')[0]; // Extract date part

    const encounter: Encounter = {
      ...input,
      id: encounterId,
      patientId: input.patientId!, // We validate this exists in the handler
      providerId,
      scheduledAt,
      status: EncounterStatus.SCHEDULED,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: providerId,
      lastModifiedBy: providerId,
    };

    const entity: EncounterEntity = {
      ...encounter,
      pk: `ENCOUNTER#${encounterId}`,
      sk: 'METADATA',
      gsi1pk: `PATIENT#${encounter.patientId}`,
      gsi1sk: `ENCOUNTER#${scheduledAt}#${encounterId}`,
      gsi2pk: `PROVIDER#${providerId}#DATE#${scheduledDate}`,
      gsi2sk: `ENCOUNTER#${scheduledAt}#${encounterId}`,
      gsi3pk: `DATE#${scheduledDate}`,
      gsi3sk: `ENCOUNTER#${scheduledAt}#${encounterId}`,
      entityType: 'ENCOUNTER',
    };

    await this.dynamodb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
        ConditionExpression: 'attribute_not_exists(pk)',
      })
    );

    logger.info('Encounter created', {
      encounterId,
      patientId: input.patientId,
      providerId,
      scheduledAt: scheduledAt,
    });

    metrics.count('EncounterCreated', 1, 'Count', { Type: input.type });

    return encounter;
  }

  /**
   * Get encounter by ID
   */
  async getEncounter(encounterId: string): Promise<Encounter | null> {
    const result = await this.dynamodb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `ENCOUNTER#${encounterId}`,
          sk: 'METADATA',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    const entity = result.Item as EncounterEntity;
    return this.entityToEncounter(entity);
  }

  /**
   * Update encounter information
   */
  async updateEncounter(
    encounterId: string,
    updates: UpdateEncounterInput,
    providerId: string
  ): Promise<Encounter> {
    const timestamp = new Date().toISOString();

    // Build update expression
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(updates).forEach(([key, value], index) => {
      if (value !== undefined) {
        updateExpressions.push(`#field${index} = :value${index}`);
        expressionAttributeNames[`#field${index}`] = key;
        expressionAttributeValues[`:value${index}`] = value;
      }
    });

    // Always update timestamps
    updateExpressions.push('#updatedAt = :updatedAt');
    updateExpressions.push('#lastModifiedBy = :lastModifiedBy');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeNames['#lastModifiedBy'] = 'lastModifiedBy';
    expressionAttributeValues[':updatedAt'] = timestamp;
    expressionAttributeValues[':lastModifiedBy'] = providerId;

    const result = await this.dynamodb.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `ENCOUNTER#${encounterId}`,
          sk: 'METADATA',
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    if (!result.Attributes) {
      throw new NotFoundError('Encounter');
    }

    logger.info('Encounter updated', {
      encounterId,
      providerId,
      updatedFields: Object.keys(updates),
    });

    return this.entityToEncounter(result.Attributes as EncounterEntity);
  }

  /**
   * Update encounter status with workflow validation
   */
  async updateEncounterStatus(
    encounterId: string,
    statusUpdate: UpdateEncounterStatusInput,
    providerId: string
  ): Promise<Encounter> {
    const encounter = await this.getEncounter(encounterId);
    if (!encounter) {
      throw new NotFoundError('Encounter');
    }

    // Validate status transition
    this.validateStatusTransition(encounter.status, statusUpdate.status);

    const updates: any = {
      status: statusUpdate.status,
      notes: statusUpdate.notes,
    };

    // Set timestamps based on status
    const timestamp = new Date().toISOString();
    switch (statusUpdate.status) {
      case EncounterStatus.IN_PROGRESS:
        updates.startedAt = timestamp;
        break;
      case EncounterStatus.COMPLETED:
        updates.completedAt = timestamp;
        break;
    }

    const updatedEncounter = await this.updateEncounter(encounterId, updates, providerId);

    metrics.count('EncounterStatusChanged', 1, 'Count', {
      FromStatus: encounter.status,
      ToStatus: statusUpdate.status,
    });

    return updatedEncounter;
  }

  /**
   * Capture patient consent for encounter
   */
  async captureConsent(
    encounterId: string,
    consent: CaptureConsentInput,
    patientId: string,
    providerId: string
  ): Promise<Encounter> {
    const encounter = await this.getEncounter(encounterId);
    if (!encounter) {
      throw new NotFoundError('Encounter');
    }

    const timestamp = new Date().toISOString();
    const newConsent = {
      ...consent,
      grantedAt: timestamp,
      grantedBy: patientId,
    };

    const consents = encounter.consents || [];
    // Remove any existing consent of the same type
    const updatedConsents = consents.filter(c => c.type !== consent.type);
    updatedConsents.push(newConsent);

    const updatedEncounter = await this.updateEncounter(
      encounterId,
      { consents: updatedConsents },
      providerId
    );

    logger.audit('CONSENT_CAPTURED', providerId, encounterId, {
      consentType: consent.type,
      granted: consent.granted,
      patientId,
    });

    metrics.count('ConsentCaptured', 1, 'Count', {
      Type: consent.type,
      Granted: consent.granted.toString(),
    });

    return updatedEncounter;
  }

  /**
   * Get daily encounter list for a provider
   */
  async getDailyEncounters(
    providerId: string,
    date: string,
    status?: EncounterStatus,
    limit = 50,
    nextToken?: string
  ): Promise<{ encounters: Encounter[]; nextToken?: string }> {
    const params: any = {
      TableName: this.tableName,
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROVIDER#${providerId}#DATE#${date}`,
      },
      Limit: limit,
    };

    if (status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeNames = { '#status': 'status' };
      params.ExpressionAttributeValues[':status'] = status;
    }

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await this.dynamodb.send(new QueryCommand(params));

    const encounters = (result.Items || [])
      .map((item: any) => this.entityToEncounter(item as EncounterEntity));

    const responseNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { encounters, nextToken: responseNextToken };
  }

  /**
   * Get all encounters for a date (all providers)
   */
  async getEncountersByDate(
    date: string,
    limit = 100,
    nextToken?: string
  ): Promise<{ encounters: Encounter[]; nextToken?: string }> {
    const params: any = {
      TableName: this.tableName,
      IndexName: 'gsi3',
      KeyConditionExpression: 'gsi3pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `DATE#${date}`,
      },
      Limit: limit,
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await this.dynamodb.send(new QueryCommand(params));

    const encounters = (result.Items || [])
      .map((item: any) => this.entityToEncounter(item as EncounterEntity));

    const responseNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { encounters, nextToken: responseNextToken };
  }

  /**
   * Get patient encounters
   */
  async getPatientEncounters(
    patientId: string,
    limit = 20,
    nextToken?: string
  ): Promise<{ encounters: Encounter[]; nextToken?: string }> {
    const params: any = {
      TableName: this.tableName,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PATIENT#${patientId}`,
      },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await this.dynamodb.send(new QueryCommand(params));

    const encounters = (result.Items || [])
      .filter((item: any) => item.entityType === 'ENCOUNTER')
      .map((item: any) => this.entityToEncounter(item as EncounterEntity));

    const responseNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { encounters, nextToken: responseNextToken };
  }

  /**
   * Add recording to encounter
   */
  async addRecording(
    encounterId: string,
    recording: {
      startTime: string;
      endTime: string;
      duration: number;
      s3Key: string;
    },
    providerId: string
  ): Promise<Encounter> {
    const encounter = await this.getEncounter(encounterId);
    if (!encounter) {
      throw new NotFoundError('Encounter');
    }

    const recordingWithId = {
      ...recording,
      id: uuidv4(),
    };

    const recordings = encounter.recordings || [];
    recordings.push(recordingWithId);

    return await this.updateEncounter(
      encounterId,
      { recordings },
      providerId
    );
  }

  /**
   * Validate status transitions
   */
  private validateStatusTransition(currentStatus: EncounterStatus, newStatus: EncounterStatus): void {
    const validTransitions: Record<EncounterStatus, EncounterStatus[]> = {
      [EncounterStatus.SCHEDULED]: [
        EncounterStatus.CHECKED_IN,
        EncounterStatus.CANCELLED,
        EncounterStatus.NO_SHOW,
      ],
      [EncounterStatus.CHECKED_IN]: [
        EncounterStatus.IN_PROGRESS,
        EncounterStatus.CANCELLED,
        EncounterStatus.NO_SHOW,
      ],
      [EncounterStatus.IN_PROGRESS]: [
        EncounterStatus.COMPLETED,
        EncounterStatus.CANCELLED,
      ],
      [EncounterStatus.COMPLETED]: [], // Terminal state
      [EncounterStatus.CANCELLED]: [], // Terminal state
      [EncounterStatus.NO_SHOW]: [], // Terminal state
    };

    const allowedTransitions = validTransitions[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BusinessLogicError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
        400
      );
    }
  }

  /**
   * Convert entity to encounter model
   */
  private entityToEncounter(entity: EncounterEntity): Encounter {
    const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, gsi3pk, gsi3sk, entityType, ...encounter } = entity;
    return encounter as Encounter;
  }
}