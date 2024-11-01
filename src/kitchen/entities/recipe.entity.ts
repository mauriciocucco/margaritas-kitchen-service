import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('recipes')
export class RecipeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('json')
  ingredients: { [ingredientName: string]: number };
}
