import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Channel } from '../entities/channel.entity';
import { CreateChannelDto, UpdateChannelDto } from '../models/channel.dto';
import { CLS_WORKSPACE_ID } from '../../../common/constants';

@Injectable()
export class ChannelService {
  constructor(private readonly cls: ClsService) {}

  async GetAll(): Promise<Channel[]> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    return Channel.find({
      where: { workspace_id: workspaceId, status: 1 },
      order: { created_on: 'DESC' },
    });
  }

  async GetById(id: string): Promise<Channel> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    const channel = await Channel.findOne({
      where: { id, workspace_id: workspaceId, status: 1 },
    });
    if (!channel) {
      throw new NotFoundException(`Channel with ID '${id}' not found`);
    }
    return channel;
  }

  async Insert(dto: CreateChannelDto): Promise<Channel> {
    const channel = new Channel();
    channel.type = dto.type;
    channel.name = dto.name;
    channel.channel_identifier = dto.channel_identifier;
    channel.credentials = dto.credentials || null;
    channel.is_connected = !!dto.credentials;

    return channel.save();
  }

  async Update(id: string, dto: UpdateChannelDto): Promise<Channel> {
    const channel = await this.GetById(id);

    if (dto.name !== undefined) channel.name = dto.name;
    if (dto.is_connected !== undefined) channel.is_connected = dto.is_connected;
    if (dto.credentials !== undefined) channel.credentials = dto.credentials;

    return channel.save();
  }

  async Delete(id: string): Promise<void> {
    const channel = await this.GetById(id);
    await channel.softRemove();
  }
}
