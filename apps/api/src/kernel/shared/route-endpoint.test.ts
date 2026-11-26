import 'reflect-metadata';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { paymentReceiptRoutes as routes, type PrismPaymentReceipt } from '@prism/types';
import { describe, expect, it } from 'vitest';
import { Endpoint } from './route-endpoint';

const receipt = {} as PrismPaymentReceipt;

class Receipts {
  @Endpoint(routes.record)
  async record() { return receipt; }

  @Endpoint(routes.list)
  list() { return [receipt]; }

  // A handler whose return type does not match the contract's response does not compile.
  // @ts-expect-error the list contract promises PrismPaymentReceipt[], not a number
  @Endpoint(routes.list)
  wrong() { return 3; }
}

describe('Endpoint', () => {
  it('takes the method, the whole path and the success status from the route contract', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, Receipts.prototype.record)).toBe(RequestMethod.POST);
    expect(Reflect.getMetadata(PATH_METADATA, Receipts.prototype.record)).toBe('payment-receipts');
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, Receipts.prototype.record)).toBe(201);
    // A status the contract does not name is 200.
    expect(Reflect.getMetadata(METHOD_METADATA, Receipts.prototype.list)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, Receipts.prototype.list)).toBe(200);
  });
});
