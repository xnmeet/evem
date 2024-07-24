import EventEmitter from 'eventemitter3';

const event = new EventEmitter();

export const enum EventType {
  VersionPlanUpdate = 'VersionPlanUpdate'
}

function eventCoreEmit() {
  const emitVersionPlan = <T>(data: T) => event.emit(EventType.VersionPlanUpdate, data);
  return {
    emitVersionPlan
  };
}

function eventCoreOn() {
  const onVersionPlan = (fn: (...args: any[]) => void) => event.on(EventType.VersionPlanUpdate, fn);
  return {
    onVersionPlan
  };
}

export const EventCoreEmit = eventCoreEmit();

export const EventCoreOn = eventCoreOn();
