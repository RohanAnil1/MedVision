import threading
from collections import OrderedDict
from .imaging import build_volume


class VolumeCache:
    """Bounded process-local cache; imported immutable instances identify snapshots."""
    def __init__(self, archive, budget=256 * 1024 * 1024):
        self.archive=archive
        self.budget=min(budget, archive.config.max_volume_bytes // 2)
        self.lock=threading.RLock()
        self.items=OrderedDict()
        self.bytes=0

    def get(self, series_uid):
        # Include every frame count and instance ID so extending an imported series invalidates it.
        snapshot=tuple((i["id"],i["frames"]) for i in self.archive.instances(series_uid))
        key=(series_uid,snapshot)
        with self.lock:
            if key in self.items:
                self.items.move_to_end(key)
                return self.items[key]
            for stale in [k for k in self.items if k[0]==series_uid]:
                self.bytes-=self.items.pop(stale)[0].nbytes
            volume,geometry=build_volume(self.archive,series_uid)
            volume.setflags(write=False)
            # Oversized volumes may be processed but must not expand the cache budget.
            if volume.nbytes<=self.budget:
                while self.bytes+volume.nbytes>self.budget and self.items:
                    self.bytes-=self.items.popitem(last=False)[1][0].nbytes
                self.items[key]=(volume,geometry)
                self.bytes+=volume.nbytes
            return volume,geometry

    def clear(self):
        with self.lock:
            self.items.clear();self.bytes=0
