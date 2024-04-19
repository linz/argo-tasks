import assert from 'node:assert';
import { describe, it } from 'node:test';

import { titleizeVectorName } from '../bmc.utils.js';

describe('titleizeVectorName', () => {
  it('Should titleize Vector names', () => {
    assert.equal(titleizeVectorName('topographic'), 'Topographic');
    assert.equal(titleizeVectorName('53382-nz-roads-addressing'), '53382 NZ Roads Addressing');
    assert.equal(
      titleizeVectorName('51153-nz-coastlines-and-islands-polygons-topo-150k'),
      '51153 NZ Coastlines And Islands Polygons Topo 150k',
    );
    assert.equal(titleizeVectorName('52168-niue-airport-polygons-topo-150k'), '52168 Niue Airport Polygons Topo 150k');
  });

  it('Should not uppercase NZ if not nz not between dashes', () => {
    assert.equal(titleizeVectorName('00121-franz-josef-addressing'), '00121 Franz Josef Addressing');
  });
});
