import numpy as np
import pytest
from medvision.imaging import build_volume, patient_reconstruction, patient_plane_geometry


def test_aligned_patient_mpr_and_projection(archive, phantom):
    for path in phantom["files"]:
        archive.import_file(path)
    volume, geometry = build_volume(archive, phantom["series"])
    for plane, axis in [("axial",0),("coronal",1),("sagittal",2)]:
        image, grid = patient_reconstruction(volume, geometry, plane, 1)
        np.testing.assert_array_equal(image, np.take(volume,1,axis=axis))
        for mode, reducer in [("mip",np.max),("minip",np.min),("aip",np.mean)]:
            actual, _ = patient_reconstruction(volume, geometry, plane, 0, mode)
            np.testing.assert_allclose(actual,reducer(volume,axis=axis),atol=1e-4)


def test_patient_axes_override_acquisition_axes():
    # Acquisition X points toward patient Y; acquisition Y points toward patient -X.
    volume=np.arange(24,dtype=np.float32).reshape(2,3,4)
    geometry={"direction":[0,1,0,-1,0,0,0,0,1],"origin":[10,20,30],"spacing":[1,2,3],"dimensions":[4,3,2]}
    axial,grid=patient_reconstruction(volume,geometry,"axial",0)
    np.testing.assert_array_equal(axial,volume[0,::-1,:].T)
    assert grid["spacing"]==[1,2]
    assert grid["origin"]==[6,20,30]


def test_tilted_patient_reconstruction_linear_field():
    angle=np.pi/4
    x=np.array([np.cos(angle),0,np.sin(angle)])
    y=np.array([0,1,0]); z=np.cross(x,y)
    direction=np.array([x,y,z]).T
    zz,yy,xx=np.indices((5,6,7))
    coords=np.stack([xx,yy,zz])
    world=np.einsum('ij,jzyx->izyx',direction,coords)
    field=world[0]+2*world[1]+3*world[2]
    geometry={"direction":[*x,*y,*z],"origin":[0,0,0],"spacing":[1,1,1],"dimensions":[7,6,5]}
    image,grid=patient_reconstruction(field.astype(np.float32),geometry,"axial",3)
    # Interior pixel samples analytically agree in patient coordinates.
    patient=np.array(grid["origin"])+[3*grid["spacing"][1],2*grid["spacing"][0],3*grid["slice_spacing"]]
    assert image[2,3]==pytest.approx(patient@[1,2,3],abs=1e-5)
