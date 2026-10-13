import threading
import uuid
from concurrent.futures import ThreadPoolExecutor


class Jobs:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="medvision-processing")
        self.lock = threading.RLock()
        self.items = {}

    def submit(self, kind, work):
        with self.lock:
            # Bound retained state and queued work.
            active = [j for j in self.items.values() if j["status"] in ("queued", "running")]
            if len(active) >= 8:
                raise ValueError("Processing queue is full.")
            if len(self.items) >= 128:
                finished = next((key for key, j in self.items.items() if j["status"] not in ("queued", "running")), None)
                if finished:
                    del self.items[finished]
            job_id = uuid.uuid4().hex
            job = {"id": job_id, "kind": kind, "status": "queued", "progress": 0, "result": None, "error": None, "cancel": threading.Event()}
            self.items[job_id] = job

        def run():
            try:
                job["status"] = "running"
                def progress(done, total):
                    job["progress"] = done / max(total, 1)
                result = work(job["cancel"], progress)
                job["result"] = result
                job["status"] = "cancelled" if job["cancel"].is_set() else "completed"
                if job["status"] == "completed":
                    job["progress"] = 1
            except Exception as exc:
                from .archive import ImagingError
                job["error"] = str(exc) if isinstance(exc, ImagingError) else "Local processing failed."
                job["status"] = "failed"
        self.executor.submit(run)
        return self.get(job_id)

    def get(self, job_id):
        with self.lock:
            return {k: v for k, v in self.items[job_id].items() if k != "cancel"}

    def cancel(self, job_id):
        with self.lock:
            self.items[job_id]["cancel"].set()
        return self.get(job_id)

    def close(self):
        with self.lock:
            for job in self.items.values():
                job["cancel"].set()
        self.executor.shutdown(wait=True, cancel_futures=False)
