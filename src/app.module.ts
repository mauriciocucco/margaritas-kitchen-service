import { Module } from '@nestjs/common';
import { KitchenModule } from './kitchen/kitchen.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import appConfig from './config/app.config';
import typeORMConfig from './config/database/typeorm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync(typeORMConfig.asProvider()),
    ClientsModule.registerAsync([
      {
        name: 'MANAGER_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'manager_queue',
            queueOptions: { durable: false },
          },
        }),
      },
      {
        name: 'WAREHOUSE_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'warehouse_queue',
            queueOptions: { durable: false },
          },
        }),
      },
    ]),
    KitchenModule,
  ],
})
export class AppModule {}
