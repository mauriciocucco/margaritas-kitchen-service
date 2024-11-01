import { Module } from '@nestjs/common';
import { KitchenModule } from './kitchen/kitchen.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './config/app.config';
import typeORMConfig from './config/database/typeorm.config';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV}`,
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync(typeORMConfig.asProvider()),
    ClientsModule.register([
      {
        name: 'MANAGER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'manager_queue',
          queueOptions: { durable: false },
        },
      },
      {
        name: 'WAREHOUSE_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://rabbitmq:5672'],
          queue: 'warehouse_queue',
          queueOptions: { durable: false },
        },
      },
    ]),
    KitchenModule,
  ],
})
export class AppModule {}
