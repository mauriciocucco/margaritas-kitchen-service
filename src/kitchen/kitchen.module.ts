import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitchenService } from './kitchen.service';
import { RecipeEntity } from './entities/recipe.entity';
import { OrderEntity } from './entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RecipeEntity, OrderEntity])],
  providers: [KitchenService],
})
export class KitchenModule {}
