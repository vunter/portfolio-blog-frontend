import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NotificationService, Notification } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationService],
    });
    service = TestBed.inject(NotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with no notifications', () => {
    expect(service.notifications()).toEqual([]);
    expect(service.hasNotifications()).toBeFalse();
  });

  describe('success', () => {
    it('should add a success notification', () => {
      service.success('Article created successfully');

      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].type).toBe('success');
      expect(service.notifications()[0].message).toBe('Article created successfully');
      expect(service.hasNotifications()).toBeTrue();
    });

    it('should return a notification id', () => {
      const id = service.success('Tag saved');
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should auto-dismiss after default duration', fakeAsync(() => {
      service.success('Will disappear');

      expect(service.notifications().length).toBe(1);

      tick(5000);
      expect(service.notifications().length).toBe(0);
    }));

    it('should auto-dismiss after custom duration', fakeAsync(() => {
      service.success('Quick notification', 2000);

      tick(2000);
      expect(service.notifications().length).toBe(0);
    }));
  });

  describe('error', () => {
    it('should add an error notification', () => {
      service.error('Failed to save article');

      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].type).toBe('error');
      expect(service.notifications()[0].message).toBe('Failed to save article');
    });

    it('should default to 8000ms duration for errors', fakeAsync(() => {
      service.error('Server error');

      tick(5000);
      expect(service.notifications().length).toBe(1); // Still visible at 5s

      tick(3000);
      expect(service.notifications().length).toBe(0); // Gone at 8s
    }));
  });

  describe('warning', () => {
    it('should add a warning notification', () => {
      service.warning('Unsaved changes');

      expect(service.notifications()[0].type).toBe('warning');
      expect(service.notifications()[0].message).toBe('Unsaved changes');
    });
  });

  describe('info', () => {
    it('should add an info notification', () => {
      service.info('Article auto-saved');

      expect(service.notifications()[0].type).toBe('info');
      expect(service.notifications()[0].message).toBe('Article auto-saved');
    });
  });

  describe('multiple notifications', () => {
    it('should show multiple notifications simultaneously', () => {
      service.success('Article created');
      service.info('Draft auto-saved');
      service.warning('Long content');

      expect(service.notifications().length).toBe(3);
    });

    it('should assign unique ids to each notification', () => {
      const id1 = service.success('First');
      const id2 = service.success('Second');
      const id3 = service.success('Third');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });
  });

  describe('dismiss', () => {
    it('should remove a specific notification by id', () => {
      const id1 = service.success('Keep me');
      const id2 = service.error('Remove me');
      service.info('Keep me too');

      service.dismiss(id2);

      expect(service.notifications().length).toBe(2);
      expect(service.notifications().find((n) => n.id === id2)).toBeUndefined();
    });

    it('should handle dismissing non-existent id gracefully', () => {
      service.success('One notification');

      service.dismiss('nonexistent-id');

      expect(service.notifications().length).toBe(1);
    });
  });

  describe('dismissAll', () => {
    it('should remove all notifications', () => {
      service.success('One');
      service.error('Two');
      service.warning('Three');
      service.info('Four');

      service.dismissAll();

      expect(service.notifications().length).toBe(0);
      expect(service.hasNotifications()).toBeFalse();
    });
  });

  describe('persistent notification (duration 0)', () => {
    it('should not auto-dismiss when duration is 0', fakeAsync(() => {
      service.success('I will persist forever', 0);

      tick(60000); // 1 minute later
      expect(service.notifications().length).toBe(1);
    }));
  });
});
