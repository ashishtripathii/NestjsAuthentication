import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from 'src/users/users.module';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [UsersModule],
})
export class AdminModule {}
