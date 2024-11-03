import { Controller, Get, UseGuards } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { KitchenService } from './kitchen.service';
import { OrderDto } from './dtos/order.dto';
import { ApiGatewayGuard } from '../common/guards/api-gateway.guard';

@UseGuards(ApiGatewayGuard)
@Controller()
export class KitchenController {
  constructor(private kitchenService: KitchenService) {}

  @Get('recipes')
  async getRecipes() {
    return await this.kitchenService.getRecipes();
  }

  @EventPattern('order_dispatched')
  async handleOrderDispatched(order: OrderDto) {
    await this.kitchenService.handleOrderDispatched(order);
  }
}
