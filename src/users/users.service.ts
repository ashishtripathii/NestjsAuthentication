import { Injectable } from '@nestjs/common';
import { db } from 'src/db';
import { users } from 'src/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { NewUser } from 'src/db/schema';

@Injectable()
export class UserService {
  // async findByEmail(email: string) {
  //   try {
  //     const user = await db.query.users.findFirst({
  //       where: eq(users.email, email),
  //     });

  //     console.log('4. findByEmail completed');

  //     return user;
  //   } catch (error: unknown) {
  //     console.error('❌ findByEmail failed');

  //     if (error instanceof Error) {
  //       console.error('message:', error.message);
  //       console.error('stack:', error.stack);
  //     } else {
  //       console.error(error);
  //     }

  //     throw error;
  //   }
  // }

  async findByEmail(email: string) {
    try {
      console.log('DATABASE_URL exists:', Boolean(process.env.DATABASE_URL));

      const result = await db.execute(
        sql`SELECT
        current_database() AS database,
        current_user AS user,
        current_schema() AS schema,
        inet_server_addr() AS server_addr
      `,
      );

      console.log('Runtime DB:', result);

      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      return user;
    } catch (error: unknown) {
      console.error('❌ findByEmail failed');

      if (error instanceof Error) {
        console.error('message:', error.message);
        console.error('stack:', error.stack);
      } else {
        console.error(error);
      }

      throw error;
    }
  }

  async findByResetToken(token: string) {
    return await db.query.users.findFirst({
      where: eq(users.resetToken, token),
    });
  }

  async findByVerificationToken(token: string) {
    return await db.query.users.findFirst({
      where: eq(users.verificationToken, token),
    });
  }

  async findById(Id: string) {
    return await db.query.users.findFirst({
      where: eq(users.id, Id),
    });
  }

  async create(data: NewUser) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return user;
  }

  async findAll() {
    return await db.query.users.findMany();
  }

  async delete(id: string) {
    await db.delete(users).where(eq(users.id, id));
  }
}
