import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ClientProxy, EventPattern } from '@nestjs/microservices';
import { OrderDto } from './dtos/order.dto';
import { OrderStatus } from './enums/order-status.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecipeEntity } from './entities/recipe.entity';
import { OrderEntity } from './entities/order.entity';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class KitchenService {
  constructor(
    @Inject('MANAGER_SERVICE') private readonly managerClient: ClientProxy,
    @Inject('WAREHOUSE_SERVICE') private readonly warehouseClient: ClientProxy,
    @InjectRepository(RecipeEntity)
    private readonly recipeRepository: Repository<RecipeEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {}

  @EventPattern('order_dispatched')
  async handleOrderCreated(order: OrderDto) {
    console.log(
      `Kitchen Service has receive the order ${order.id} for processing.`,
    );

    try {
      const orderInProgress = { ...order, statusId: OrderStatus.IN_PROGRESS };

      this.managerClient.emit('order_status_changed', orderInProgress);

      const recipe = await this.getRandomRecipe();
      const orderData = {
        id: order.id,
        recipeId: recipe.id,
      };

      await this.orderRepository
        .createQueryBuilder()
        .insert()
        .into(OrderEntity)
        .values(orderData)
        .execute();

      const ingredientsAvailable = await this.requestIngredients(
        recipe.ingredients,
      );

      if (!ingredientsAvailable) {
        const pausedOrder = { ...order, statusId: OrderStatus.PAUSED };

        return this.managerClient.emit('order_status_changed', pausedOrder);
      }

      await this.processOrder(order, recipe);

      const completedOrder = { ...order, statusId: OrderStatus.COMPLETED };

      this.managerClient.emit('order_status_changed', completedOrder);

      console.log(`Kitchen Service has completed the order ${order.id}.`);
    } catch (error) {
      console.error(`Failed to process order ${order.id}:`, error);

      const failedOrder = { ...order, statusId: OrderStatus.FAILED };

      this.managerClient.emit('order_status_changed', failedOrder);
    }
  }

  async getRandomRecipe(): Promise<RecipeEntity> {
    const recipes = await this.recipeRepository.find();
    const randomIndex = Math.floor(Math.random() * recipes.length);

    return recipes[randomIndex];
  }

  async requestIngredients(ingredients: {
    [key: string]: number;
  }): Promise<boolean> {
    console.log('Asking for ingredients to the Warehouse:', ingredients);

    try {
      const response = await firstValueFrom(
        this.warehouseClient.send('request_ingredients', ingredients),
      );

      if (!response.success) {
        console.error('Ingredients not available:', ingredients);

        return false;
      }

      return true;
    } catch (error) {
      console.error('Communication error with the Warehouse:', error);

      throw new InternalServerErrorException(error);
    }
  }

  async processOrder(order: any, recipe: RecipeEntity): Promise<void> {
    console.log(`Preparing the order ${order.id} - ${recipe.name}...`);

    try {
      const response = await firstValueFrom(
        this.warehouseClient.send('reduce_ingredients', recipe.ingredients),
      );

      if (!response.success) {
        throw new InternalServerErrorException(
          'Failed to reduce ingredients in the Warehouse',
        );
      }

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log(`Order ${order.id} - ${recipe.name} prepared.`);
          resolve();
        }, 10000);
      });
    } catch (error) {
      console.error(
        `Failed to reduce ingredients for order ${order.id}:`,
        error,
      );

      throw error;
    }
  }
}
