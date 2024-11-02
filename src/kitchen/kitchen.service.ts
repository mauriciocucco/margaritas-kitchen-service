import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
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
  ) {
    this.managerClient.connect();
    this.warehouseClient.connect();
  }

  async handleOrderDispatched(order: OrderDto) {
    console.log(
      `Kitchen Service has receive the order ${order.id} for processing.`,
    );

    try {
      const orderInProgress = { ...order, statusId: OrderStatus.IN_PROGRESS };

      this.managerClient.emit('order_status_changed', orderInProgress);

      const recipe = await this.getRandomRecipe();

      console.log('Random recipe selected:', recipe);

      const orderData = {
        id: order.id,
        recipeId: recipe.id,
        customerId: order.customerId,
      };

      console.log('Creating order:', orderData);

      await this.orderRepository
        .createQueryBuilder()
        .insert()
        .into(OrderEntity)
        .values(orderData)
        .execute();

      await this.requestIngredients(recipe.ingredients);

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

  async requestIngredients(ingredients: { [key: string]: number }) {
    console.log('Asking for ingredients to the Warehouse:', ingredients);

    try {
      return await firstValueFrom(
        this.warehouseClient.send('request_ingredients', ingredients),
      );
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

      console.log('Ingredients reduced:', response);

      if (!response.success) {
        throw new Error('Failed to reduce ingredients in the Warehouse');
      }

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log(`Order ${order.id} - ${recipe.name} prepared.`);
          resolve();
        }, 5000);
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
