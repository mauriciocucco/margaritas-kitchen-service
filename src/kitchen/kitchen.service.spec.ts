import { Test } from '@nestjs/testing';
import { KitchenService } from './kitchen.service';
import { ClientProxy } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecipeEntity } from './entities/recipe.entity';
import { OrderEntity } from './entities/order.entity';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { OrderDto } from './dtos/order.dto';
import { of } from 'rxjs';
import { Events } from './enums/events.enum';
import { OrderStatus } from './enums/order-status.enum';
import { InternalServerErrorException } from '@nestjs/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';

describe('KitchenService', () => {
  let kitchenService: KitchenService;
  let managerClient: ClientProxy;
  let warehouseClient: ClientProxy;
  let recipeRepository: Repository<RecipeEntity>;
  let orderRepository: Repository<OrderEntity>;
  let dataSource: DataSource;
  let queryRunner: DeepMocked<QueryRunner>;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        KitchenService,
        {
          provide: 'MANAGER_SERVICE',
          useValue: {
            connect: jest.fn(),
            emit: jest.fn(),
          },
        },
        {
          provide: 'WAREHOUSE_SERVICE',
          useValue: {
            connect: jest.fn(),
            send: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RecipeEntity),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(OrderEntity),
          useClass: Repository,
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    kitchenService = moduleRef.get<KitchenService>(KitchenService);
    managerClient = moduleRef.get<ClientProxy>('MANAGER_SERVICE');
    warehouseClient = moduleRef.get<ClientProxy>('WAREHOUSE_SERVICE');
    recipeRepository = moduleRef.get<Repository<RecipeEntity>>(
      getRepositoryToken(RecipeEntity),
    );
    orderRepository = moduleRef.get<Repository<OrderEntity>>(
      getRepositoryToken(OrderEntity),
    );
    dataSource = moduleRef.get<DataSource>(DataSource);

    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    queryRunner = createMock<QueryRunner>();

    jest.spyOn(dataSource, 'createQueryRunner').mockReturnValue(queryRunner);
    jest
      .spyOn(orderRepository, 'createQueryBuilder')
      .mockReturnValue(mockQueryBuilder);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecipes', () => {
    it('should return an array of recipes', async () => {
      const recipes = [
        {
          id: 1,
          name: 'Recipe 1',
          ingredients: { ingredient1: 1, ingredient2: 2 },
        },
      ] as RecipeEntity[];

      jest.spyOn(recipeRepository, 'find').mockResolvedValue(recipes);

      const result = await kitchenService.getRecipes();

      expect(result).toEqual(recipes);
      expect(recipeRepository.find).toHaveBeenCalledWith({
        cache: {
          id: 'recipes_cache',
          milliseconds: Number.MAX_SAFE_INTEGER,
        },
      });
    });
  });

  describe('handleOrderDispatched', () => {
    it('should process orders successfully', async () => {
      const orders: OrderDto[] = [
        { id: 1, customerId: 1 } as unknown as OrderDto,
        { id: 2, customerId: 2 } as unknown as OrderDto,
      ];

      const recipe = {
        id: 1,
        name: 'Recipe 1',
        ingredients: { ingredient1: 1, ingredient2: 2 },
      } as RecipeEntity;

      jest.spyOn(kitchenService, 'getRandomRecipe').mockResolvedValue(recipe);
      jest.spyOn(managerClient, 'emit').mockImplementation(() => of(null));
      jest.spyOn(mockQueryBuilder, 'insert').mockReturnThis();
      jest.spyOn(mockQueryBuilder, 'into').mockReturnThis();
      jest.spyOn(mockQueryBuilder, 'values').mockReturnThis();
      jest.spyOn(mockQueryBuilder, 'execute').mockResolvedValue({});

      jest.spyOn(kitchenService, 'requestIngredients').mockResolvedValue(null);
      jest.spyOn(kitchenService, 'processOrder').mockResolvedValue(null);

      await kitchenService.handleOrderDispatched(orders);

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();

      expect(kitchenService.getRandomRecipe).toHaveBeenCalledTimes(
        orders.length,
      );
      expect(managerClient.emit).toHaveBeenCalled();
      expect(kitchenService.requestIngredients).toHaveBeenCalled();
      expect(kitchenService.processOrder).toHaveBeenCalledTimes(orders.length);
    });

    it('should rollback transaction on error', async () => {
      const orders: OrderDto[] = [
        { id: 1, customerId: 1 },
      ] as unknown as OrderDto[];

      jest
        .spyOn(kitchenService, 'getRandomRecipe')
        .mockRejectedValue(new Error('Random error'));

      await kitchenService.handleOrderDispatched(orders);

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getRandomRecipe', () => {
    it('should return a random recipe', async () => {
      const recipes = [
        { id: 1, name: 'Recipe 1' },
        { id: 2, name: 'Recipe 2' },
      ] as RecipeEntity[];

      jest.spyOn(recipeRepository, 'find').mockResolvedValue(recipes);

      const result = await kitchenService.getRandomRecipe();

      expect(recipes).toContain(result);
      expect(recipeRepository.find).toHaveBeenCalled();
    });
  });

  describe('requestIngredients', () => {
    it('should request ingredients successfully', async () => {
      const ingredientsRequest = {
        ingredients: { ingredient1: 2 },
        orders: [{ id: 1 }],
      };

      jest.spyOn(warehouseClient, 'send').mockReturnValue(of(null));

      const result =
        await kitchenService.requestIngredients(ingredientsRequest);

      expect(warehouseClient.send).toHaveBeenCalledWith(
        Events.REQUEST_INGREDIENTS,
        ingredientsRequest,
      );
      expect(result).toBeNull();
    });

    it('should throw an InternalServerErrorException on error', async () => {
      const ingredientsRequest = {
        ingredients: { ingredient1: 2 },
        orders: [{ id: 1 }],
      };

      jest
        .spyOn(warehouseClient, 'send')
        .mockReturnValue(of(Promise.reject(new Error('Warehouse error'))));

      await expect(
        kitchenService.requestIngredients(ingredientsRequest),
      ).rejects.toThrowError(InternalServerErrorException);

      expect(warehouseClient.send).toHaveBeenCalledWith(
        Events.REQUEST_INGREDIENTS,
        ingredientsRequest,
      );
    });
  });

  describe('processOrder', () => {
    it('should process order successfully', async () => {
      jest.useFakeTimers();

      const order = { id: 1 };
      const recipeName = 'Recipe 1';

      jest.spyOn(managerClient, 'emit').mockImplementation(() => of(null));

      const promise = kitchenService.processOrder(order, recipeName);

      jest.advanceTimersByTime(3000);

      await promise;

      expect(managerClient.emit).toHaveBeenCalledWith(
        Events.ORDER_STATUS_CHANGED,
        {
          ...order,
          statusId: OrderStatus.COMPLETED,
        },
      );

      jest.useRealTimers();
    });

    it('should handle errors during order processing', async () => {
      jest.useFakeTimers();

      const order = { id: 1 };
      const recipeName = 'Recipe 1';

      jest.spyOn(managerClient, 'emit').mockImplementation(() => of(null));

      jest.spyOn(global, 'setTimeout').mockImplementation(() => {
        throw new Error('Processing error');
      });

      await expect(
        kitchenService.processOrder(order, recipeName),
      ).rejects.toThrow();

      jest.useRealTimers();
    });
  });
});
