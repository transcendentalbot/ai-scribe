'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function TestS3AccessPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const testS3Access = async () => {
    setIsLoading(true);
    const results: any[] = [];

    // Test URL from the logs
    const testUrl = prompt('Paste the S3 presigned URL from the console logs:');
    if (!testUrl) {
      setIsLoading(false);
      return;
    }

    // 1. Test basic fetch
    try {
      console.log('Testing basic fetch...');
      const response = await fetch(testUrl, {
        method: 'GET',
        mode: 'cors',
      });
      
      results.push({
        test: 'Basic Fetch',
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (response.ok) {
        const blob = await response.blob();
        results.push({
          test: 'Blob Info',
          size: blob.size,
          type: blob.type,
        });

        // Read first bytes
        const buffer = await blob.slice(0, 20).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const signature = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        
        results.push({
          test: 'File Signature',
          signature,
          isWebM: signature === '1a 45 df a3',
          isOgg: signature === '4f 67 67 53',
          first20Bytes: Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '),
        });
      }
    } catch (error) {
      results.push({
        test: 'Basic Fetch',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 2. Test HEAD request
    try {
      console.log('Testing HEAD request...');
      const response = await fetch(testUrl, {
        method: 'HEAD',
        mode: 'cors',
      });
      
      results.push({
        test: 'HEAD Request',
        success: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      });
    } catch (error) {
      results.push({
        test: 'HEAD Request',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 3. Test with Audio element
    try {
      console.log('Testing with Audio element...');
      const audio = new Audio();
      
      await new Promise((resolve, reject) => {
        audio.onloadedmetadata = () => {
          results.push({
            test: 'Audio Element',
            success: true,
            duration: audio.duration,
            readyState: audio.readyState,
          });
          resolve(true);
        };
        
        audio.onerror = () => {
          results.push({
            test: 'Audio Element',
            success: false,
            errorCode: audio.error?.code,
            errorMessage: audio.error?.message,
          });
          reject(audio.error);
        };
        
        audio.src = testUrl;
        audio.load();
      });
    } catch (error) {
      console.error('Audio element error:', error);
    }

    // 4. Parse URL components
    try {
      const url = new URL(testUrl);
      const params = Object.fromEntries(url.searchParams.entries());
      
      results.push({
        test: 'URL Analysis',
        hostname: url.hostname,
        pathname: url.pathname,
        bucket: url.pathname.split('/')[1],
        key: url.pathname.split('/').slice(2).join('/'),
        algorithm: params['X-Amz-Algorithm'],
        expires: params['X-Amz-Expires'],
        hasToken: !!params['X-Amz-Security-Token'],
      });
    } catch (error) {
      results.push({
        test: 'URL Analysis',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    setTestResults(results);
    setIsLoading(false);
    console.log('S3 Access Test Results:', results);
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">S3 Access Diagnostic Tool</h1>
      
      <Alert className="mb-6">
        <AlertDescription>
          This tool helps diagnose S3 presigned URL access issues. 
          Open the browser console, try to play a recording, then copy the S3 URL from the error.
        </AlertDescription>
      </Alert>

      <div className="mb-6">
        <Button onClick={testS3Access} disabled={isLoading}>
          {isLoading ? 'Testing...' : 'Test S3 Access'}
        </Button>
      </div>

      {testResults.length > 0 && (
        <div className="space-y-4">
          {testResults.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {result.test}
                  {result.success && <span className="text-green-600">✓</span>}
                  {result.success === false && <span className="text-red-600">✗</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm overflow-auto bg-gray-100 p-2 rounded">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Common S3 403 Error Causes:</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Presigned URL has expired (check X-Amz-Expires)</li>
          <li>Signature mismatch (ResponseContentType/Disposition parameters)</li>
          <li>IAM role doesn't have GetObject permission</li>
          <li>Bucket policy is blocking access</li>
          <li>Object doesn't exist at the specified key</li>
          <li>KMS key permissions (for encrypted objects)</li>
        </ul>
      </div>
    </div>
  );
}