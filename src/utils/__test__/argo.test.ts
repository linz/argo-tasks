import o from 'ospec';
import { getArgoLocation } from '../argo.js';

o.spec('argoLocation', () => {
  o('should not die if ARGO_TEMPLATE doesnt exist', () => {
    delete process.env['ARGO_TEMPLATE'];
    o(getArgoLocation()).equals(null);
  });

  o('should not die if ARGO_TEMPLATE in missing keys', () => {
    process.env['ARGO_TEMPLATE'] = '{}';
    o(getArgoLocation()).equals(null);

    process.env['ARGO_TEMPLATE'] = JSON.stringify({ archiveLocation: {} });
    o(getArgoLocation()).equals(null);

    process.env['ARGO_TEMPLATE'] = JSON.stringify({ archiveLocation: { s3: {} } });
    o(getArgoLocation()).equals(null);
  });
});
