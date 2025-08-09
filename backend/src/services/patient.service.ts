import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { Patient, PatientEntity, CreatePatientInput, UpdatePatientInput } from '../types/patient';
import { NotFoundError, ConflictError } from '../errors';
import { logger } from '../utils/logger';

export class PatientService {
  constructor(
    private dynamodb: DynamoDBDocumentClient,
    private tableName: string
  ) {}

  /**
   * Create a new patient record
   */
  async createPatient(input: CreatePatientInput, providerId: string): Promise<Patient> {
    const patientId = uuidv4();
    const timestamp = new Date().toISOString();

    // Check if MRN already exists
    const existingMrn = await this.getPatientByMrn(input.mrn);
    if (existingMrn) {
      throw new ConflictError('Patient with this MRN already exists');
    }

    const patient: Patient = {
      ...input,
      id: patientId,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: providerId,
      lastModifiedBy: providerId,
    };

    const entity: PatientEntity = {
      ...patient,
      pk: `PATIENT#${patientId}`,
      sk: 'PROFILE',
      gsi1pk: `MRN#${input.mrn}`,
      gsi1sk: `PATIENT#${patientId}`,
      gsi2pk: `PROVIDER#${providerId}`,
      gsi2sk: `PATIENT#${patientId}#${timestamp}`,
      entityType: 'PATIENT',
    };

    await this.dynamodb.send(
      new PutCommand({
        TableName: this.tableName,
        Item: entity,
        ConditionExpression: 'attribute_not_exists(pk)',
      })
    );

    logger.info('Patient created', {
      patientId,
      mrn: input.mrn,
      providerId,
    });

    return patient;
  }

  /**
   * Get patient by ID
   */
  async getPatient(patientId: string): Promise<Patient | null> {
    const result = await this.dynamodb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `PATIENT#${patientId}`,
          sk: 'PROFILE',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    const entity = result.Item as PatientEntity;
    return this.entityToPatient(entity);
  }

  /**
   * Get patient by MRN
   */
  async getPatientByMrn(mrn: string): Promise<Patient | null> {
    const result = await this.dynamodb.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `MRN#${mrn}`,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    const entity = result.Items[0] as PatientEntity;
    return this.entityToPatient(entity);
  }

  /**
   * Search patients by name, MRN, or date of birth
   */
  async searchPatients(
    query: string,
    limit = 20,
    nextToken?: string
  ): Promise<{ patients: Patient[]; nextToken?: string }> {
    // This is a simplified search - in production, consider using OpenSearch
    const params: any = {
      TableName: this.tableName,
      FilterExpression: 'contains(firstName, :query) OR contains(lastName, :query) OR contains(mrn, :query)',
      ExpressionAttributeValues: {
        ':query': query,
      },
      Limit: limit,
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await this.dynamodb.send(new QueryCommand(params));

    const patients = (result.Items || [])
      .filter((item: any) => item.entityType === 'PATIENT')
      .map((item: any) => this.entityToPatient(item as PatientEntity));

    const responseNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { patients, nextToken: responseNextToken };
  }

  /**
   * Get patients by provider
   */
  async getPatientsByProvider(
    providerId: string,
    limit = 50,
    nextToken?: string
  ): Promise<{ patients: Patient[]; nextToken?: string }> {
    const params: any = {
      TableName: this.tableName,
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `PROVIDER#${providerId}`,
      },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    };

    if (nextToken) {
      params.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
    }

    const result = await this.dynamodb.send(new QueryCommand(params));

    const patients = (result.Items || [])
      .filter((item: any) => item.entityType === 'PATIENT')
      .map((item: any) => this.entityToPatient(item as PatientEntity));

    const responseNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { patients, nextToken: responseNextToken };
  }

  /**
   * Update patient information
   */
  async updatePatient(
    patientId: string,
    updates: UpdatePatientInput,
    providerId: string
  ): Promise<Patient> {
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
          pk: `PATIENT#${patientId}`,
          sk: 'PROFILE',
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(pk)',
        ReturnValues: 'ALL_NEW',
      })
    );

    if (!result.Attributes) {
      throw new NotFoundError('Patient');
    }

    logger.info('Patient updated', {
      patientId,
      providerId,
      updatedFields: Object.keys(updates),
    });

    return this.entityToPatient(result.Attributes as PatientEntity);
  }

  /**
   * Get multiple patients by IDs
   */
  async getPatientsByIds(patientIds: string[]): Promise<Patient[]> {
    if (patientIds.length === 0) {
      return [];
    }

    const keys = patientIds.map(id => ({
      pk: `PATIENT#${id}`,
      sk: 'PROFILE',
    }));

    const result = await this.dynamodb.send(
      new BatchGetCommand({
        RequestItems: {
          [this.tableName]: {
            Keys: keys,
          },
        },
      })
    );

    const items = result.Responses?.[this.tableName] || [];
    return items.map((item: any) => this.entityToPatient(item as PatientEntity));
  }

  /**
   * Convert entity to patient model
   */
  private entityToPatient(entity: PatientEntity): Patient {
    const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, entityType, ...patient } = entity;
    return patient as Patient;
  }
}