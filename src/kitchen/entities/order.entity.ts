import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RecipeEntity } from './recipe.entity';

@Entity('order')
export class OrderEntity {
  @Column({ type: 'uuid', nullable: false, primary: true })
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'recipe_id', nullable: true, default: null })
  recipeId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => RecipeEntity)
  @JoinColumn({ name: 'recipe_id' })
  recipe: RecipeEntity;
}
