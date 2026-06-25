import type {
  Receivable,
  ReceivableStatus,
  ReceivableSummary,
  CreateReceivableBody,
  UpdateReceivableBody,
} from '../../../shared/receivables/types.js';
import { AppError } from '../../lib/errors.js';
import type { ReceivableRepository } from './receivables.repository.js';

export class ReceivableService {
  constructor(private readonly repo: ReceivableRepository) {}

  list(status?: ReceivableStatus): Promise<Receivable[]> {
    return this.repo.findAll(status);
  }

  summary(): Promise<ReceivableSummary> {
    return this.repo.summary();
  }

  create(body: CreateReceivableBody): Promise<Receivable> {
    return this.repo.create({ ...body, description: body.description.trim() });
  }

  update(id: number, body: UpdateReceivableBody): Promise<Receivable> {
    return this.repo.update(id, body);
  }

  async settle(id: number): Promise<Receivable> {
    const status = await this.repo.getRawStatus(id);
    if (status === null) throw new AppError(404, 'Receivable not found');
    if (status === 'paid') throw new AppError(409, 'Already settled');
    return this.repo.settle(id);
  }

  remove(id: number): Promise<void> {
    return this.repo.remove(id);
  }
}
