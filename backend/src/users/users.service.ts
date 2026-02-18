import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/** Service for managing user records. */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Find a user by their OIDC subject identifier. */
  async findByOidcSubject(oidcSubject: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { oidcSubject } });
  }

  /** Find a user by ID. */
  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  /** Create a new user record. */
  async create(data: {
    oidcSubject: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  }): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }
}
