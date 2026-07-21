// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'healthy',
      service: 'nimmadhi-backend',
      timestamp: new Date().toISOString(),
    };
  }
}