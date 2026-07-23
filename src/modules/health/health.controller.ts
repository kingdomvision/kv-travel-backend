import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', database: 'up' };
  }
}

