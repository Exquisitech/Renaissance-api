import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    const email = 'test@example.com';
    const password = 'password123';

    const mockUser = {
      id: 'user-123',
      email,
      password: 'hashedPassword',
      role: UserRole.USER,
    };

    beforeEach(() => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    });

    it('should return user if credentials are valid', async () => {
      const result = await service.validateUser(email, password);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.password);
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password: 'hashedPassword',
      role: UserRole.USER,
      balance: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockToken = 'jwt-token-123';

    beforeEach(() => {
      mockJwtService.sign.mockReturnValue(mockToken);
    });

    it('should return auth response with token and user data', async () => {
      const result = await service.login(mockUser);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          balance: mockUser.balance,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
        accessToken: mockToken,
      });
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('posts');
      expect(result.user).not.toHaveProperty('comments');
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-123',
      email: registerDto.email,
      password: 'hashedPassword',
      role: UserRole.USER,
      balance: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockToken = 'jwt-token-123';

    beforeEach(() => {
      mockUserRepository.findOne.mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue(mockToken);
    });

    it('should register a new user successfully', async () => {
      const result = await service.register(registerDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        ...registerDto,
        password: 'hashedPassword',
      });
      expect(mockUserRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          balance: mockUser.balance,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        },
        accessToken: mockToken,
      });
    });

    it('should throw UnauthorizedException if email already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateToken', () => {
    const token = 'valid-jwt-token';
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      role: UserRole.USER,
    };

    it('should return decoded payload for valid token', async () => {
      mockJwtService.verify.mockReturnValue(payload);

      const result = await service.validateToken(token);

      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateToken(token)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});</content>
<parameter name="filePath">c:\Users\u-adamu\Desktop\wave 2\Renaissance-api\backend\src\auth\auth.service.spec.ts