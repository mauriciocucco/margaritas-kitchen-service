import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenService } from './kitchen.service';
import { RecipeEntity } from './entities/recipe.entity';
import { OrderEntity } from './entities/order.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KitchenController } from './kitchen.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecipeEntity, OrderEntity]),
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
            queueOptions: { durable: true },
            prefetchCount: 10,
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
            queueOptions: { durable: true },
            prefetchCount: 1,
          },
        }),
      },
    ]),
  ],
  controllers: [KitchenController],
  providers: [KitchenService],
})
export class KitchenModule {}
