import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { KitchenService } from './kitchen.service';
import { OrderDto } from './dtos/order.dto';

@Controller()
export class KitchenController {
  constructor(private kitchenService: KitchenService) {}

  @EventPattern('order_dispatched')
  async handleOrderDispatched(order: OrderDto) {
    await this.kitchenService.handleOrderDispatched(order);
  }
}
