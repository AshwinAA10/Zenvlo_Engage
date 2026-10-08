import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '../models/user.dto';

@Injectable()
export class UserService {
  async GetAll(): Promise<User[]> {
    return User.find({
      order: { created_on: 'DESC' },
    });
  }

  async GetById(id: string): Promise<User> {
    const user = await User.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }
    return user;
  }

  async Insert(dto: CreateUserDto): Promise<User> {
    const existing = await User.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(dto.password, salt);

    const user = new User();
    user.email = dto.email;
    user.password_hash = password_hash;
    user.first_name = dto.first_name || null;
    user.last_name = dto.last_name || null;

    return user.save();
  }

  async Update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.GetById(id);

    if (dto.first_name !== undefined) user.first_name = dto.first_name;
    if (dto.last_name !== undefined) user.last_name = dto.last_name;
    if (dto.avatar_url !== undefined) user.avatar_url = dto.avatar_url;

    return user.save();
  }

  async Delete(id: string): Promise<void> {
    const user = await this.GetById(id);
    await user.softRemove();
  }
}
