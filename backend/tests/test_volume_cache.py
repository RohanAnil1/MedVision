import pytest
from medvision.volume_cache import VolumeCache


def test_cache_reuses_readonly_volume_and_invalidates_extended_series(archive,phantom):
    for path in phantom["files"][:3]:
        archive.import_file(path)
    cache=VolumeCache(archive)
    first,geometry=cache.get(phantom["series"])
    assert cache.get(phantom["series"])[0] is first
    with pytest.raises(ValueError):
        first[0,0,0]=100
    archive.import_file(phantom["files"][3])
    updated,_=cache.get(phantom["series"])
    assert updated is not first
    assert updated.shape[0]==4
    assert len(cache.items)==1
    assert cache.bytes==updated.nbytes
    cache.clear()
    assert cache.bytes==0


def test_oversized_volume_is_not_retained(archive,phantom):
    for path in phantom["files"]:
        archive.import_file(path)
    cache=VolumeCache(archive,budget=1)
    image,_=cache.get(phantom["series"])
    assert image.shape==(5,6,8)
    assert cache.bytes==0
    assert not cache.items
