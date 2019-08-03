require('jest-extended');
const { toStream, devNullStream } = require('./testUtils');
const { Collector, JsonStream } = require('../src');
process.on('unhandledRejection', error => {
  console.error(error);
});
describe('Jetsons is loaded', () => {
  describe('and value cant be parsed to legal JSON', () => {
    it('should reject if tried to collect object', () => {
      const collector = new Collector([
        toStream([''], Collector.jsonTypes.raw),
        1,
      ]);

      expect(collector.toObject()).rejects.toBeInstanceOf(Error);
    });
    it('should resolve illegal json string if tried to collect json', () => {
      const collector = new Collector([
        toStream([''], Collector.jsonTypes.raw),
        1,
      ]);

      expect(collector.toJson()).resolves.toEqual('[,1]');
    });
  });
  describe('And if stream has ended', () => {
    let endedStream = toStream('value');

    beforeAll(done => {
      endedStream.on('end', done);
      endedStream.pipe(devNullStream());
    });

    it('should return error when object contains an ended stream', () => {
      const collector = new Collector([endedStream]);

      const expectedError = new Error(
        'Readable Stream has already ended. Unable to process it!',
      );
      expect(collector.toObject()).rejects.toEqual(expectedError);
      expect(collector.toJson()).rejects.toEqual(expectedError);
    });

    it('should return error is stream already has ended', () => {
      const collector = new Collector(endedStream);

      const expectedError = new Error(
        'Readable Stream has already ended. Unable to process it!',
      );
      expect(collector.toObject()).rejects.toEqual(expectedError);
      expect(collector.toJson()).rejects.toEqual(expectedError);
    });
  });

  describe('And someone else is processing the stream', () => {
    const expectedError = new Error(
      'Readable Stream is in flowing mode, data may be lost',
    );

    it('should return error if stream is in flowing state before initializatoin', () => {
      const flowingStream = toStream('value');
      flowingStream.pipe(devNullStream());

      const collector = new Collector(flowingStream);
      expect(collector.toJson()).rejects.toEqual(expectedError);
      expect(collector.toObject()).rejects.toEqual(expectedError);
    });

    it('should return error if stream inside structure is in flowing state before initializatoin', () => {
      const flowingStream = toStream('valuesdsaødlkjsadølkjsad');
      flowingStream.pipe(devNullStream());

      const collector = new Collector([flowingStream]);
      expect(collector.toJson()).rejects.toEqual(expectedError);
      expect(collector.toObject()).rejects.toEqual(expectedError);
    });

    it('should return error if stream starts flowing during processing', () => {
      const flowingStream = toStream('valuesdsaødlkjsadølkjsad');
      const collector = new Collector(flowingStream);

      flowingStream.pipe(devNullStream());
      expect(collector.toJson()).rejects.toEqual(expectedError);
      expect(collector.toObject()).rejects.toEqual(expectedError);
    });

    it('should return error if stream inside structure starts flowing during processing', () => {
      const flowingStream = toStream('value');
      const collector = new Collector([flowingStream]);

      flowingStream.pipe(devNullStream());
      expect(collector.toJson()).rejects.toEqual(expectedError);
      expect(collector.toObject()).rejects.toEqual(expectedError);
    });
  });
  describe('And unsupported types are used', () => {
    it('should throw TypeError if a BigInt in encounterd', () => {
      // eslint-disable-next-line no-undef
      const collector = new Collector({ aBigInt: BigInt(42) });
      const expectedError = new Error(
        `BigInt value can't be serialized in JSON`,
      );
      expect(collector.toJson()).rejects.toEqual(expectedError);
    });
  });
  describe('And processed stream throws error', () => {
    it('should emit error if processed stream emits error', done => {
      const streamWithError = toStream(
        new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('A error'));
          }, 500);
        }),
      );
      const collector = new Collector({ streamWithError });
      collector.toJson().catch(error => {
        expect(error).toBeInstanceOf(Error);
        done();
      });
    });
  });

  describe('And JsonStream is aborted/closed', () => {
    it('should propagate close to streams on stack', done => {
      let output = '';
      const streamToBeEnded = toStream(
        new Promise(resolve => {
          setTimeout(() => {
            resolve('Returned after 500ms');
          }, 500);
        }),
      ).on('close', () => {
        expect(output).not.toContain('Returned after 500ms');
        done();
      });
      const jsonStream = new JsonStream([streamToBeEnded]);
      jsonStream
        .on('data', data => {
          output += data.toString();
        })
        .pipe(devNullStream());
      setTimeout(() => {
        jsonStream.destroy();
      }, 100);
    });
    it('should propagate close to requestStreams on stack', done => {
      let output = '';
      const requesStreamToBeEnded = toStream(
        new Promise(resolve => {
          setTimeout(() => {
            resolve('Returned after 500ms');
          }, 500);
        }),
      ).on('close', () => {});
      requesStreamToBeEnded.setHeader = () => {};
      requesStreamToBeEnded.abort = () => {
        expect(output).not.toContain('Returned after 500ms');
        requesStreamToBeEnded.destroy();
        done();
      };
      const jsonStream = new JsonStream([requesStreamToBeEnded]);
      jsonStream
        .on('data', data => {
          output += data.toString();
        })
        .pipe(devNullStream());
      setTimeout(() => {
        jsonStream.destroy();
      }, 100);
    });
  });
});
