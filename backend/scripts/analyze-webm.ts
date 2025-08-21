import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET_NAME = process.env.RECORDINGS_BUCKET_NAME || 'ai-scribe-recordings';

interface WebMAnalysis {
  key: string;
  size: number;
  hasWebMSignature: boolean;
  signature: string;
  codecInfo: string;
  firstBytes: string;
  ebmlVersion?: number;
  docType?: string;
}

async function analyzeWebMBuffer(buffer: Buffer): Promise<Partial<WebMAnalysis>> {
  const bytes = new Uint8Array(buffer);
  
  // Check WebM signature
  const signature = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const hasWebMSignature = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  
  // Look for DocType (WebM identifier)
  const decoder = new TextDecoder();
  let docType = 'Unknown';
  let codecInfo = 'Unknown';
  
  // Search for DocType (0x4282)
  for (let i = 0; i < Math.min(bytes.length - 10, 1000); i++) {
    if (bytes[i] === 0x42 && bytes[i + 1] === 0x82) {
      const length = bytes[i + 2];
      if (length > 0 && length < 20) {
        docType = decoder.decode(bytes.slice(i + 3, i + 3 + length));
        break;
      }
    }
  }
  
  // Search for CodecID (0x86)
  for (let i = 0; i < Math.min(bytes.length - 10, 5000); i++) {
    if (bytes[i] === 0x86) {
      const length = bytes[i + 1] & 0x7f;
      if (length > 0 && length < 50) {
        codecInfo = decoder.decode(bytes.slice(i + 2, i + 2 + length));
        break;
      }
    }
  }

  return {
    hasWebMSignature,
    signature,
    codecInfo,
    docType,
    firstBytes: Array.from(bytes.slice(0, 50)).map(b => b.toString(16).padStart(2, '0')).join(' '),
  };
}

async function analyzeRecording(key: string): Promise<WebMAnalysis> {
  console.log(`\nAnalyzing: ${key}`);
  
  try {
    // Get object metadata
    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Range: 'bytes=0-10000', // Only fetch first 10KB for analysis
    });
    
    const response = await s3Client.send(getObjectCommand);
    const chunks: Uint8Array[] = [];
    
    if (response.Body) {
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
    }
    
    const buffer = Buffer.concat(chunks);
    const analysis = await analyzeWebMBuffer(buffer);
    
    return {
      key,
      size: response.ContentLength || 0,
      ...analysis,
    } as WebMAnalysis;
    
  } catch (error) {
    console.error(`Error analyzing ${key}:`, error);
    return {
      key,
      size: 0,
      hasWebMSignature: false,
      signature: 'Error',
      codecInfo: 'Error',
      firstBytes: 'Error reading file',
    };
  }
}

async function listAndAnalyzeRecordings() {
  try {
    console.log(`Analyzing recordings in bucket: ${BUCKET_NAME}`);
    
    // List objects
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 10, // Analyze first 10 recordings
    });
    
    const listResponse = await s3Client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log('No recordings found in bucket');
      return;
    }
    
    const analyses: WebMAnalysis[] = [];
    
    // Analyze each recording
    for (const object of listResponse.Contents) {
      if (object.Key && (object.Key.endsWith('.webm') || object.Key.endsWith('.ogg') || object.Key.endsWith('.mp4'))) {
        const analysis = await analyzeRecording(object.Key);
        analyses.push(analysis);
      }
    }
    
    // Print summary
    console.log('\n=== ANALYSIS SUMMARY ===\n');
    
    analyses.forEach(analysis => {
      console.log(`File: ${analysis.key}`);
      console.log(`  Size: ${(analysis.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Valid WebM: ${analysis.hasWebMSignature ? 'YES' : 'NO'}`);
      console.log(`  Signature: ${analysis.signature}`);
      console.log(`  DocType: ${analysis.docType}`);
      console.log(`  Codec: ${analysis.codecInfo}`);
      console.log(`  First 50 bytes: ${analysis.firstBytes}`);
      console.log('');
    });
    
    // Summary statistics
    const validWebM = analyses.filter(a => a.hasWebMSignature).length;
    const codecTypes = new Map<string, number>();
    analyses.forEach(a => {
      codecTypes.set(a.codecInfo, (codecTypes.get(a.codecInfo) || 0) + 1);
    });
    
    console.log('=== STATISTICS ===');
    console.log(`Total files analyzed: ${analyses.length}`);
    console.log(`Valid WebM files: ${validWebM}`);
    console.log('Codec distribution:');
    codecTypes.forEach((count, codec) => {
      console.log(`  ${codec}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error listing recordings:', error);
  }
}

// Download a sample file for local analysis
async function downloadSampleFile(key: string) {
  try {
    console.log(`Downloading ${key} for local analysis...`);
    
    const getObjectCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    
    const response = await s3Client.send(getObjectCommand);
    const chunks: Uint8Array[] = [];
    
    if (response.Body) {
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
    }
    
    const buffer = Buffer.concat(chunks);
    const fileName = path.basename(key);
    const localPath = path.join(__dirname, `sample-${fileName}`);
    
    fs.writeFileSync(localPath, buffer);
    console.log(`Downloaded to: ${localPath}`);
    console.log(`File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Detailed analysis
    const analysis = await analyzeWebMBuffer(buffer);
    console.log('\nDetailed analysis:');
    console.log(analysis);
    
  } catch (error) {
    console.error('Error downloading file:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'download' && args[1]) {
    // Download specific file
    await downloadSampleFile(args[1]);
  } else {
    // List and analyze recordings
    await listAndAnalyzeRecordings();
  }
}

main().catch(console.error);