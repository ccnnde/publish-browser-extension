import { checkStatusCode } from '../utils/fetch';
import fetch from 'node-fetch';
import fs from 'fs';

export interface EdgeApiOptions {
  productId: string;
  clientId: string;
  clientSecret: string;
  accessTokenUrl: string;
}

export interface EdgeTokenDetails {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface DraftResponse {
  operationId: string;
}

/**
 * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/addons-api-reference#response-1
 */
export interface DraftOperation {
  id: string;
  createdTime: string;
  lastUpdatedTime: string;
  status: 'InProgress' | 'Succeeded' | 'Failed';
  message: string | null;
  errorCode: string | null;
  errors: string[] | null;
}

export class EdgeApi {
  constructor(readonly options: EdgeApiOptions) {}

  /**
   * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api#sample-request
   */
  async getToken(): Promise<EdgeTokenDetails> {
    const form = new URLSearchParams();
    form.set('client_id', this.options.clientId);
    form.set(
      'scope',
      'https://api.addons.microsoftedge.microsoft.com/.default',
    );
    form.set('client_secret', this.options.clientSecret);
    form.set('grant_type', 'client_credentials');

    const res = await fetch(this.options.accessTokenUrl, {
      method: 'POST',
      body: form,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    await checkStatusCode(res);
    return await res.json();
  }

  /**
   * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api#uploading-a-package-to-update-an-existing-submission
   */
  async uploadDraft(params: {
    token: EdgeTokenDetails;
    productId: string;
    zipFile: string;
  }): Promise<DraftResponse> {
    const endpoint = `https://api.addons.microsoftedge.microsoft.com/v1/products/${params.productId}/submissions/draft/package`;
    const file = fs.createReadStream(params.zipFile);
    const res = await fetch(endpoint, {
      method: 'POST',
      body: file,
      headers: {
        Authorization: this.getAuthHeader(params.token),
        'Content-Type': 'application/zip',
      },
    });
    await checkStatusCode(res);
    const operationId = res.headers.get('Location');
    if (!operationId)
      throw Error(
        'Edge API did not return an operation ID in the Location header.',
      );
    return { operationId };
  }

  /**
   * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api#checking-the-status-of-a-package-upload
   */
  async uploadDraftOperation(params: {
    token: EdgeTokenDetails;
    productId: string;
    operationId: string;
  }): Promise<DraftOperation> {
    const endpoint = `https://api.addons.microsoftedge.microsoft.com/v1/products/${params.productId}/submissions/draft/package/operations/${params.operationId}`;
    const res = await fetch(endpoint, {
      headers: {
        Authorization: this.getAuthHeader(params.token),
      },
    });
    await checkStatusCode(res);
    return await res.json();
  }

  /**
   * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api#publishing-the-submission
   */
  async publish(params: {
    productId: string;
    token: EdgeTokenDetails;
  }): Promise<void> {
    const endpoint = `https://api.addons.microsoftedge.microsoft.com/v1/products/${params.productId}/submissions`;
    const res = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        Authorization: this.getAuthHeader(params.token),
      },
    });
    await checkStatusCode(res);
  }

  private getAuthHeader(token: EdgeTokenDetails): string {
    return `${token.token_type} ${token.access_token}`;
  }
}
