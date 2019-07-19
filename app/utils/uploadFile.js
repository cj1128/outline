// @flow
import { client } from './ApiClient';
import invariant from 'invariant';

type Options = {
  name?: string,
};

export const uploadFile = async (
  file: File | Blob,
  option?: Options = { name: '' }
) => {
  const formData = new FormData();
  formData.append('name', file.name || option.name);
  formData.append('file', file);

  const response = await client.post('/users.upload', formData, { contentType: false });

  invariant(response, 'Response should be available');

  return response.data
};

export const dataUrlToBlob = (dataURL: string) => {
  var blobBin = atob(dataURL.split(',')[1]);
  var array = [];
  for (var i = 0; i < blobBin.length; i++) {
    array.push(blobBin.charCodeAt(i));
  }
  const file = new Blob([new Uint8Array(array)], { type: 'image/png' });
  return file;
};
