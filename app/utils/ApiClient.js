// @flow
import { map, trim } from 'lodash';
import invariant from 'invariant';
import stores from 'stores';
import download from './download';

type Options = {
  baseUrl?: string,
};

class ApiClient {
  baseUrl: string;
  userAgent: string;

  constructor(options: Options = {}) {
    this.baseUrl = options.baseUrl || '/api';
    this.userAgent = 'OutlineFrontend';
  }

  // options:
  // headers: {}
  fetch = async (
    path: string,
    method: string,
    data: ?Object,
    options: Object = {}
  ) => {
    // Construct headers
    const headers = new Headers({
      Accept: 'application/json',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    });

    if(options.headers) {
      for(let key in options.headers) {
        headers.set(key, options.headers[key])
      }
    }

    if(headers.get('Content-Type') == null) {
      if(!(data instanceof FormData)) {
        headers.set('Content-Type', 'application/json')
      }
    }

    if (stores.auth.authenticated) {
      invariant(stores.auth.token, 'JWT token not set properly');
      headers.set('Authorization', `Bearer ${stores.auth.token}`);
    }

    let body;
    let modifiedPath;

    if (method === 'GET') {
      if (data) {
        modifiedPath = `${path}?${data && this.constructQueryString(data)}`;
      } else {
        modifiedPath = path;
      }
    } else if (method === 'POST' || method === 'PUT') {
      if(headers.get("Content-Type") === "application/json") {
        body = data ? JSON.stringify(data) : undefined;
      } else {
        body = data
      }
    }

    let response;
    try {
      response = await fetch(this.baseUrl + (modifiedPath || path), {
        method,
        body,
        headers,
        redirect: 'follow',
        credentials: 'omit',
        cache: 'no-cache',
      });
    } catch (err) {
      if (window.navigator.onLine) {
        throw new Error('A network error occurred, try again?');
      } else {
        throw new Error('No internet connection available');
      }
    }

    const success = response.status >= 200 && response.status < 300;

    if (options.download && success) {
      const blob = await response.blob();
      const fileName = (
        response.headers.get('content-disposition') || ''
      ).split('filename=')[1];

      download(blob, trim(fileName, '"'));
      return;
    } else if (success) {
      return response.json();
    }

    // Handle 401, log out user
    if (response.status === 401) {
      stores.auth.logout();
      return;
    }

    // Handle failed responses
    const error = {};
    error.statusCode = response.status;
    error.response = response;

    try {
      const parsed = await response.json();
      error.message = parsed.message || '';
      error.error = parsed.error;
      error.data = parsed.data;
    } catch (_err) {
      // we're trying to parse an error so JSON may not be valid
    }

    throw error;
  };

  get = (path: string, data: ?Object, options?: Object) => {
    return this.fetch(path, 'GET', data, options);
  };

  post = (path: string, data: ?Object, options?: Object) => {
    return this.fetch(path, 'POST', data, options);
  };

  // Helpers
  constructQueryString = (data: { [key: string]: string }) => {
    return map(
      data,
      (v, k) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    ).join('&');
  };
}

export default ApiClient;

// In case you don't want to always initiate, just import with `import { client } ...`
export const client = new ApiClient();
