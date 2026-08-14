import { Guard, ExecutionContext, Injectable } from '@nitrostack/core';

@Injectable()
export class WorkerGuard implements Guard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const role = (context as any).auth?.role;
    if (role === 'worker' || role === 'admin') {
      return true;
    }
    console.error(`WorkerGuard: Denied access for role ${role}`);
    return false;
  }
}

@Injectable()
export class ManagerGuard implements Guard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const role = (context as any).auth?.role;
    if (role === 'manager' || role === 'admin') {
      return true;
    }
    console.error(`ManagerGuard: Denied access for role ${role}`);
    return false;
  }
}
