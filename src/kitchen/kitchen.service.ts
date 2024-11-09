import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { OrderDto } from './dtos/order.dto';
import { OrderStatus } from './enums/order-status.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RecipeEntity } from './entities/recipe.entity';
import { OrderEntity } from './entities/order.entity';
import { firstValueFrom } from 'rxjs';
import { Events } from './enums/events.enum';

@Injectable()
export class KitchenService {
  constructor(
    @Inject('MANAGER_SERVICE') private readonly managerClient: ClientProxy,
    @Inject('WAREHOUSE_SERVICE') private readonly warehouseClient: ClientProxy,
    @InjectRepository(RecipeEntity)
    private readonly recipeRepository: Repository<RecipeEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    private readonly dataSource: DataSource,
  ) {
    this.managerClient.connect();
    this.warehouseClient.connect();
  }

  async getRecipes(): Promise<RecipeEntity[]> {
    return await this.recipeRepository.find({
      cache: {
        id: 'recipes_cache',
        milliseconds: Number.MAX_SAFE_INTEGER,
      },
    });
  }

  async handleOrderDispatched(orders: OrderDto[]): Promise<void> {
    console.log(
      `Kitchen Service has receive the orders for processing: ${JSON.stringify(orders)}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    const ordersInProgress = [];
    const ingredientsMap: { [key: string]: number } = {};

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      for (const order of orders) {
        const recipe = await this.getRandomRecipe();

        console.log(
          `Random recipe selected for order ${order.id}: ${recipe.name}`,
        );

        const orderInProgress = {
          ...order,
          statusId: OrderStatus.IN_PROGRESS,
          recipeName: recipe.name,
        };

        ordersInProgress.push(orderInProgress);

        for (const [ingredient, quantity] of Object.entries(
          recipe.ingredients,
        )) {
          ingredientsMap[ingredient] =
            (ingredientsMap[ingredient] || 0) + quantity;
        }
      }

      await firstValueFrom(
        this.managerClient.emit(Events.ORDER_STATUS_CHANGED, ordersInProgress),
      );

      const orderEntities = ordersInProgress.map(
        ({ id, recipeId, customerId }) => ({
          id,
          recipeId,
          customerId,
        }),
      );

      await this.orderRepository
        .createQueryBuilder()
        .insert()
        .into(OrderEntity)
        .values(orderEntities)
        .execute();

      const ingredientsRequest = {
        ingredients: ingredientsMap,
        orders: ordersInProgress.map((order) => ({ id: order.id })),
      };

      console.log('Requesting ingredients in bulk:', ingredientsRequest);

      const { success } = await this.requestIngredients(ingredientsRequest);

      if (!success) throw new Error('Failed to request ingredients');

      await this.processOrder(ordersInProgress);

      await queryRunner.commitTransaction();

      console.log(`Kitchen Service has completed processing of orders.`);
    } catch (error) {
      console.error(`handleOrderDispatched error:`, error);

      const failedOrders = orders.map((order) => ({
        id: order.id,
        statusId: OrderStatus.FAILED,
      }));

      await queryRunner.rollbackTransaction();

      await firstValueFrom(
        this.managerClient.emit(Events.ORDER_STATUS_CHANGED, failedOrders),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async getRandomRecipe(): Promise<RecipeEntity> {
    const recipes = await this.recipeRepository.find();
    const randomIndex = Math.floor(Math.random() * recipes.length);

    return recipes[randomIndex];
  }

  async requestIngredients(ingredientsRequest: {
    ingredients: {
      [key: string]: number;
    };
    orders: {
      id: number;
    }[];
  }): Promise<{ success: boolean }> {
    console.log(
      'Asking for ingredients to the Warehouse:',
      ingredientsRequest.ingredients,
    );

    try {
      return await firstValueFrom(
        this.warehouseClient.send(
          Events.REQUEST_INGREDIENTS,
          ingredientsRequest,
        ),
      );
    } catch (error) {
      console.error('Communication error with the Warehouse:', error);

      throw new InternalServerErrorException(error);
    }
  }

  async processOrder(orders: OrderDto[]) {
    console.log(`Preparing the orders: ${JSON.stringify(orders)}`);

    try {
      const completedOrders = orders.map((order) => ({
        id: order.id,
        statusId: OrderStatus.COMPLETED,
      }));

      console.log(
        `Orders processed successfully: ${JSON.stringify(completedOrders)}`,
      );

      await new Promise<void>((resolve) => setTimeout(resolve, 3000));

      return await firstValueFrom(
        this.managerClient.emit(Events.ORDER_STATUS_CHANGED, completedOrders),
      );
    } catch (error) {
      console.error('Failed to process orders:', error);

      throw new InternalServerErrorException(error);
    }
  }
}
