export class UserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export class BusinessNotFoundError extends Error {
  constructor(message = 'Business not found') {
    super(message);
    this.name = 'BusinessNotFoundError';
  }
}

export class BusinessOwnershipError extends Error {
  constructor(message = 'User does not own this business') {
    super(message);
    this.name = 'BusinessOwnershipError';
  }
}

export class AccountNotFoundError extends Error {
  constructor(message = 'Account not found') {
    super(message);
    this.name = 'AccountNotFoundError';
  }
}

export class AccountOwnershipError extends Error {
  constructor(message = 'User does not own this account') {
    super(message);
    this.name = 'AccountOwnershipError';
  }
}

export class CategoryOwnershipError extends Error {
  constructor(message = 'User does not own this category') {
    super(message);
    this.name = 'CategoryOwnershipError';
  }
}

export class ContactOwnershipError extends Error {
  constructor(message = 'User does not own this contact') {
    super(message);
    this.name = 'ContactOwnershipError';
  }
}

export class IncomeSourceOwnershipError extends Error {
  constructor(message = 'User does not own this income source') {
    super(message);
    this.name = 'IncomeSourceOwnershipError';
  }
}

export class SupplierOwnershipError extends Error {
  constructor(message = 'User does not own this supplier') {
    super(message);
    this.name = 'SupplierOwnershipError';
  }
}

export class InvoiceOwnershipError extends Error {
  constructor(message = 'User does not own this invoice') {
    super(message);
    this.name = 'InvoiceOwnershipError';
  }
}

export class RecurringSeriesOwnershipError extends Error {
  constructor(message = 'User does not own this recurring series') {
    super(message);
    this.name = 'RecurringSeriesOwnershipError';
  }
}

export class ClientOwnershipError extends Error {
  constructor(message = 'User does not own this client') {
    super(message);
    this.name = 'ClientOwnershipError';
  }
}

export class ServiceOwnershipError extends Error {
  constructor(message = 'User does not own this service') {
    super(message);
    this.name = 'ServiceOwnershipError';
  }
}

export class ProjectOwnershipError extends Error {
  constructor(message = 'User does not own this project') {
    super(message);
    this.name = 'ProjectOwnershipError';
  }
}

export class ProjectNotFoundError extends Error {
  constructor(message = 'Project not found') {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export class InvoiceNotFoundError extends Error {
  constructor(message = 'Invoice not found') {
    super(message);
    this.name = 'InvoiceNotFoundError';
  }
}

export class TransactionNotFoundError extends Error {
  constructor(message = 'Transaction not found') {
    super(message);
    this.name = 'TransactionNotFoundError';
  }
}

export class TransactionOwnershipError extends Error {
  constructor(message = 'User does not own this transaction') {
    super(message);
    this.name = 'TransactionOwnershipError';
  }
}

export class BudgetNotFoundError extends Error {
  constructor(message = 'Budget not found') {
    super(message);
    this.name = 'BudgetNotFoundError';
  }
}

export class BudgetOwnershipError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'BudgetOwnershipError';
  }
}

export class ProjectTaskNotFoundError extends Error {
  constructor(message = 'Project task not found') {
    super(message);
    this.name = 'ProjectTaskNotFoundError';
  }
}

export class ProjectTaskOwnershipError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ProjectTaskOwnershipError';
  }
}
