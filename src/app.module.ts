import { Module } from '@nestjs/common';
import { KitchenModule } from './kitchen/kitchen.module';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
    KitchenModule,
  ],
})
export class AppModule {}
