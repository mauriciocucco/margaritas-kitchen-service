import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const configService = new ConfigService();
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [configService.get<string>('RABBITMQ_URL')],
        queue: 'kitchen_queue',
        queueOptions: {
          durable: false,
        },
      },
    },
  );

  await app.listen();

  console.log('Kitchen Service is listening');
}

bootstrap();
