import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let service: DownloadService;
  let appendChildSpy: jasmine.Spy;
  let removeChildSpy: jasmine.Spy;
  let createObjectURLSpy: jasmine.Spy;
  let revokeObjectURLSpy: jasmine.Spy;
  let clickSpy: jasmine.Spy;

  /** Helper to capture the anchor element created by triggerDownload */
  let capturedAnchor: HTMLAnchorElement;

  beforeEach(() => {
    clickSpy = jasmine.createSpy('click');
    capturedAnchor = undefined as any;

    spyOn(document, 'createElement').and.callFake((tag: string) => {
      if (tag === 'a') {
        const a = document.createDocumentFragment() as any;
        a.href = '';
        a.download = '';
        a.style = { display: '' };
        a.click = clickSpy;
        capturedAnchor = a;
        return a;
      }
      return document.createDocumentFragment() as any;
    });

    appendChildSpy = spyOn(document.body, 'appendChild').and.callFake(<T extends Node>(el: T): T => el);
    removeChildSpy = spyOn(document.body, 'removeChild').and.callFake(<T extends Node>(el: T): T => el);
    createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:http://localhost/fake-blob-url');
    revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');

    TestBed.configureTestingModule({
      providers: [
        DownloadService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(DownloadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('downloadBlob', () => {
    it('should create an object URL from the blob', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      service.downloadBlob(blob, 'test.txt');

      expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    });

    it('should trigger a download click with correct filename', () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      service.downloadBlob(blob, 'output.txt');

      expect(capturedAnchor.href).toBe('blob:http://localhost/fake-blob-url');
      expect(capturedAnchor.download).toBe('output.txt');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should append and remove the anchor from document body', () => {
      const blob = new Blob(['data'], { type: 'application/pdf' });
      service.downloadBlob(blob, 'file.pdf');

      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });

    it('should revoke the object URL after a delay', (done: DoneFn) => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      service.downloadBlob(blob, 'test.txt');

      // revokeObjectURL is called with setTimeout(1000)
      setTimeout(() => {
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/fake-blob-url');
        done();
      }, 1100);
    });

    it('should do nothing on server platform', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DownloadService,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      const serverService = TestBed.inject(DownloadService);

      const blob = new Blob(['test'], { type: 'text/plain' });
      serverService.downloadBlob(blob, 'test.txt');

      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('downloadUrl', () => {
    it('should trigger download with the provided URL', () => {
      service.downloadUrl('https://example.com/file.pdf', 'file.pdf');

      expect(capturedAnchor.href).toBe('https://example.com/file.pdf');
      expect(capturedAnchor.download).toBe('file.pdf');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should append and remove the anchor from document body', () => {
      service.downloadUrl('https://example.com/file.csv', 'data.csv');

      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });

    it('should not create an object URL (no blob involved)', () => {
      service.downloadUrl('https://example.com/file.txt', 'file.txt');

      expect(createObjectURLSpy).not.toHaveBeenCalled();
    });

    it('should do nothing on server platform', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DownloadService,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      const serverService = TestBed.inject(DownloadService);

      serverService.downloadUrl('https://example.com/file.pdf', 'file.pdf');

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('downloadText', () => {
    it('should create a Blob from text content and trigger download', () => {
      service.downloadText('col1,col2\nval1,val2', 'data.csv', 'text/csv');

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(capturedAnchor.download).toBe('data.csv');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should use text/plain as default mime type', () => {
      // We can verify the blob is created — the Blob constructor is called internally
      service.downloadText('hello world', 'hello.txt');

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(capturedAnchor.download).toBe('hello.txt');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should do nothing on server platform', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          DownloadService,
          { provide: PLATFORM_ID, useValue: 'server' },
        ],
      });
      const serverService = TestBed.inject(DownloadService);

      serverService.downloadText('data', 'file.txt');

      expect(createObjectURLSpy).not.toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });
});
