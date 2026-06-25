import type {
  Payable,
  PayableStatus,
  PayableSummary,
  CreatePayableBody,
  UpdatePayableBody,
} from '../../../shared/payables/types.js';
import { AppError } from '../../lib/errors.js';
import type { PayableRepository } from './payables.repository.js';

export class PayableService {
  constructor(private readonly repo: PayableRepository) {}

  list(status?: PayableStatus): Promise<Payable[]> {
    return this.repo.findAll(status);
  }

  summary(): Promise<PayableSummary> {
    return this.repo.summary();
  }

  create(body: CreatePayableBody): Promise<Payable> {
    return this.repo.create({ ...body, description: body.description.trim() });
  }

  update(id: number, body: UpdatePayableBody): Promise<Payable> {
    return this.repo.update(id, body);
  }

  async settle(id: number): Promise<Payable> {
    const status = await this.repo.getRawStatus(id);
    if (status === null) throw new AppError(404, 'Payable not found');
    if (status === 'paid') throw new AppError(409, 'Already settled');
    return this.repo.settle(id);
  }

  remove(id: number): Promise<void> {
    return this.repo.remove(id);
  }
}
