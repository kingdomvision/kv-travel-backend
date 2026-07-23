import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private client!: S3Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const endpoint = this.config.get<string>('app.storage.endpoint');
    this.bucket = this.config.get<string>('app.storage.bucket') ?? 'kv-travel';
    this.client = new S3Client({
      region: this.config.get<string>('app.storage.region') ?? 'us-east-1',
      endpoint: endpoint || undefined,
      forcePathStyle: this.config.get<boolean>('app.storage.forcePathStyle') ?? false,
      credentials: {
        accessKeyId: this.config.get<string>('app.storage.accessKeyId') ?? '',
        secretAccessKey:
          this.config.get<string>('app.storage.secretAccessKey') ?? '',
      },
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  buildKey(tenantId: string, fileName: string): string {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `tenants/${tenantId}/documents/${Date.now()}-${safe}`;
  }

  async putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async getSignedDownloadUrl(key: string, expiresIn = 300): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }
}
