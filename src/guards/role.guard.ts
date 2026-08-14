import { Guard, ExecutionContext, Injectable } from '@nitrostack/core';

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

@Injectable()
export class SupplierGuard implements Guard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const role = (context as any).auth?.role;
    if (role === 'supplier' || role === 'admin') {
      return true;
    }
    console.error(`SupplierGuard: Denied access for role ${role}`);
    return false;
  }
}
