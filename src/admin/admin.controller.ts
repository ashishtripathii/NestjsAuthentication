import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserService } from 'src/users/users.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private userService: UserService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users- admin only' })
  findAll() {
    return this.userService.findAll();
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user - admin only' })
  remove(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
