import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { User } from '../users/entities/user.entity';
import { RolePermission } from './entities/permission.entity';
import { AdminRoleEntity } from './entities/admin-role.entity';
import { AdminAuditLog } from '../admin/entities/admin-audit-log.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RoleManagementController } from './controllers/role-management.controller';
import { AdminRoleController } from './controllers/admin-role.controller';
import { RoleManagementService } from './services/role-management.service';
import { PermissionService } from './services/permission.service';
import { AdminAuditService } from './services/admin-audit.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PermissionGuard } from './guards/permission.guard';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([
      User,
      RolePermission,
      AdminRoleEntity,
      AdminAuditLog,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret',
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, RoleManagementController, AdminRoleController],
  providers: [
    AuthService,
    RoleManagementService,
    PermissionService,
    AdminAuditService,
    JwtStrategy,
    LocalStrategy,
    PermissionGuard,
    AdminRoleGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [
    AuthService,
    RoleManagementService,
    PermissionService,
    AdminAuditService,
    PermissionGuard,
    AdminRoleGuard,
  ],
})
export class AuthModule {}
