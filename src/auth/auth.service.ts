import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { UserService } from 'src/users/users.service';
import { EmailService } from './email.service';

import type { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { Response } from 'express';
import type { User } from 'src/db/schema';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  // async register(dto: RegisterDto) {
  //   const existingUser = await this.userService.findByEmail(dto.email);

  //   if (existingUser) {
  //     throw new ConflictException(`An Account with this email already exists`);
  //   }

  //   const passwordHash = await bcrypt.hash(dto.password, 12);

  //   const verificationToken = crypto.randomBytes(32).toString('hex');
  //   const verificationTokenExpiresAt = new Date(
  //     Date.now() + 24 * 60 * 60 * 1000,
  //   );

  //   const user = await this.userService.create({
  //     email: dto.email,
  //     name: dto.email,
  //     passwordHash,
  //     verificationToken,
  //     verificationTokenExpiresAt,
  //   });

  //   await this.emailService.sendVerificationEmail(
  //     user.email,
  //     verificationToken,
  //   );

  //   return {
  //     message:
  //       'Registration Successfull, Please check your email to verify your account ',
  //   };
  // }

  async register(dto: RegisterDto) {
    console.log('1. register started');

    console.log('2. before findByEmail');

    const existingUser = await this.userService.findByEmail(dto.email);

    console.log('3. after findByEmail', existingUser);

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    console.log('3. password hashed');

    const verificationToken = crypto.randomBytes(32).toString('hex');

    console.log('4. token generated');

    const verificationTokenExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    const user = await this.userService.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      verificationToken,
      verificationTokenExpiresAt,
    });

    console.log('5. user created', user);

    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
    );

    console.log('6. email sent');

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException(`Invalid email or password`);
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException(`Invalid email or password`);
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(
        'please verify your email before logging in',
      );
    }

    const tokens = await this.generateTokens(user);

    await this.saveRefereshToken(user.id, tokens.refreshToken);

    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN'),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private async saveRefereshToken(userId: string, refreshToken: string) {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.userService.update(userId, { refreshTokenHash });
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  async refresh(refreshToken: string, res: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    let payload: { sub: string; email: string };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      console.log(error);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userService.findById(payload.sub);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenMatch = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!tokenMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user);

    await this.saveRefereshToken(user.id, tokens.refreshToken);

    this.setRefreshTokenCookie(res, refreshToken);

    return {
      accessToken: tokens.accessToken,
    };
  }

  async logout(userId: string, res: Response) {
    await this.userService.update(userId, { refreshTokenHash: null });
    res.clearCookie('refresh_token');

    return {
      message: 'Logged Out successfully ',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      console.log('User not found');
      return {
        message:
          'If an account with that email exists, a reset link has been sent. ',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');

    const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.userService.update(user.id, {
      resetToken,
      resetTokenExpiresAt,
    });

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return {
      message:
        'If an account with that email exists, a reset link has been sent.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userService.findByResetToken(token);

    if (!user || !user.resetToken) {
      throw new BadRequestException('Invalid reset token');
    }

    if (user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException(
        'Reset token has expired. Please request a new one',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.userService.update(user.id, {
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    });

    return {
      message: 'Password reset successfull.You can now login',
    };
  }

  async verifyEmail(token: string, res: Response) {
    const user = await this.userService.findByVerificationToken(token);

    if (!user || !user.verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    if (
      user.verificationTokenExpiresAt &&
      user.verificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'verification Token has expired. Please request a new one',
      );
    }

    await this.userService.update(user.id, {
      isVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    });

    const tokens = await this.generateTokens(user);

    await this.saveRefereshToken(user.id, tokens.refreshToken);

    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      message: 'Email verified successully,you are now logged in',
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
