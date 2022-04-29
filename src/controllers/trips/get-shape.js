const { decode, encode } = require("@googlemaps/polyline-codec");
const APIStatus = require("../../configs/api-errors");
const { logger } = require("../../configs/config");
const sequelize = require("../../db/database");
const Route = require("../../models/Route");
const Shape = require("../../models/Shape");

const CUT_START_RADIUS = 500;
const CUT_STEP_RADIUS = 100;
const CUT_MAX_RADIUS = 10000;
const INTERPOLATION_ITERATION = 100;

exports.getShape = async function (req, res) {
    logger.info(`${req.method} ${req.baseUrl + req.path}`);

    if (!req.params.route_id)
        return res.send(APIStatus.BAD_REQUEST).status(APIStatus.BAD_REQUEST.status);

    const routeId = req.params.route_id || "";

    if (routeId === "all") {
        try {
            return res
                .status(APIStatus.OK.status)
                .send({ status: APIStatus.OK, data: await getAllShapes() });
        } catch (error) {
            return res
                .status(APIStatus.INTERNAL.SERVER_ERROR.status)
                .send({ status: APIStatus.INTERNAL.SERVER_ERROR.status, message: error });
        }
    }

    const from = formatCoordinates(req.query.from);
    const to = formatCoordinates(req.query.to);
    const reversed = req.query.reversed === "true" || false;

    const shape = await getShape(routeId);

    const encodedShape = cut(
        from,
        to,
        shape,
        CUT_START_RADIUS,
        CUT_STEP_RADIUS,
        CUT_MAX_RADIUS,
        reversed,
    );

    if (!shape)
        return res.status(APIStatus.INTERNAL.SERVER_ERROR.status).send({
            status: APIStatus.INTERNAL.SERVER_ERROR.status,
            message: `Error: Either the server couldn't find a route with route_id ${routeId} or the shape of that route could not be found.`,
        });

    return res.status(APIStatus.OK.status).send({
        status: APIStatus.OK,
        data: encodedShape,
    });
};

function formatCoordinates(string) {
    if (!string) return;

    let splittedString = string.split(",");

    if (splittedString.length !== 2) {
        logger.error("Invalid `from` query. Too few arguments. Neglecting.");
        return;
    }

    let lat = parseFloat(splittedString[0]);
    let lng = parseFloat(splittedString[1]);

    if (isNaN(lat) || isNaN(lng)) {
        logger.error("Invalid `from` query. Latitude or longitude is not a number. Neglecting.");
        return;
    }

    return {
        lat: lat,
        lng: lng,
    };
}

async function getAllShapes() {
    return await Shape.findAll({});
}

async function getShape(routeId) {
    let route;

    try {
        route = await Route.findOne({
            where: { route_id: routeId },
        });
    } catch (error) {
        logger.error(`Unable to find route with route_id ${routeId}: ${error}`);
        return;
    }

    if (!route) {
        logger.error(`Unable to find route with route_id ${routeId}.`);
        return;
    }

    if (!route.shape_id) {
        logger.error(`Route with route_id ${routeId} doesn't contain shape_id`);
        return;
    }

    let shape;

    try {
        shape = await Shape.findOne({
            where: { shape_id: route.shape_id },
        });
    } catch (error) {
        logger.error(`Unable to find shape with shape_id ${route.shape_id}: ${error}`);
        return;
    }

    if (!shape) {
        logger.error(`Unable to find shape with shape_id ${route.shape_id}.`);
        return;
    }

    return shape;
}

function cut(from, to, shape, startRadius, stepRadius, maxRadius, reversed) {
    if (!shape) {
        logger.error(`Invalid shape object`);
        return;
    }

    if (!shape.shape_encoded || !shape.shape_encoded_level) {
        logger.error(`Shape is not undefined but has invalid structure`);
    }

    if (from) {
        if (!from.lat || !from.lng) {
            logger.error(`Invalid from object`);
            return;
        }
    }
    if (to) {
        if (!to.lat || !to.lng) {
            logger.error(`Invalid to object`);
            return;
        }
    }

    let decodedShape = decode(shape.shape_encoded, 5);
    let fromSpliceIndex, toSpliceIndex;

    if (from) {
        let interpolated = doCoordinatesInterpolation(
            decodedShape,
            from,
            startRadius,
            stepRadius,
            maxRadius,
            INTERPOLATION_ITERATION,
        );

        fromSpliceIndex = interpolated.between[1];

        if (!to) {
            if (!reversed) {
                decodedShape.splice(fromSpliceIndex, 0, [interpolated.lat, interpolated.lng]);
                decodedShape.splice(0, fromSpliceIndex);
            } else {
                decodedShape.splice(fromSpliceIndex, 0, [interpolated.lat, interpolated.lng]);
                decodedShape.splice(fromSpliceIndex + 1, decodedShape.length - 1);
            }

            return {
                shape_encoded: encode(decodedShape, 5),
            };
        }
    }

    if (to) {
        let interpolated = doCoordinatesInterpolation(
            decodedShape,
            to,
            startRadius,
            stepRadius,
            maxRadius,
            INTERPOLATION_ITERATION,
        );

        toSpliceIndex = interpolated.between[1];

        if (!from) {
            if (!reversed) {
                decodedShape.splice(toSpliceIndex, 0, [interpolated.lat, interpolated.lng]);
                decodedShape.splice(toSpliceIndex, decodedShape.length - 1);
            } else {
                decodedShape.splice(toSpliceIndex, 0, [interpolated.lat, interpolated.lng]);
                decodedShape.splice(0, toSpliceIndex);
            }

            return {
                shape_encoded: encode(decodedShape, 5),
            };
        }
    }

    if (!reversed) {
        if (fromSpliceIndex > toSpliceIndex) {
            decodedShape.splice(fromSpliceIndex, decodedShape.length - 1);
            decodedShape.splice(0, toSpliceIndex);
        } else {
            decodedShape.splice(toSpliceIndex, decodedShape.length - 1);
            decodedShape.splice(0, fromSpliceIndex);
        }
    } else {
        if (fromSpliceIndex <= toSpliceIndex) {
            decodedShape.splice(fromSpliceIndex, decodedShape.length - 1);
            decodedShape.splice(0, toSpliceIndex);
        } else {
            decodedShape.splice(toSpliceIndex, decodedShape.length - 1);
            decodedShape.splice(0, fromSpliceIndex);
        }
    }

    return {
        shape_encoded: encode(
            fromSpliceIndex > toSpliceIndex ? decodedShape.reverse() : decodedShape,
        ),
    };
}

function doCoordinatesInterpolation(
    decodedShape,
    coordinates,
    startRadius,
    stepRadius,
    maxRadius,
    interpolationIteration,
) {
    let { distancesFromCoordinates, minDistance } = findMinDistance(
        decodedShape,
        coordinates,
        startRadius,
        stepRadius,
        maxRadius,
    );

    let interpolated;
    let between = [];

    if (distancesFromCoordinates.length >= 2 && minDistance) {
        let minDistanceIndex = 0;

        for (let i = 0; i < distancesFromCoordinates.length; i++) {
            if (distancesFromCoordinates[i].index === minDistance.index) {
                minDistanceIndex = i;
                break;
            }
        }

        if (minDistanceIndex === 0) {
            interpolated = interpolate(
                distancesFromCoordinates[0],
                distancesFromCoordinates[1],
                coordinates,
                interpolationIteration,
            );
            between = [distancesFromCoordinates[0].index, distancesFromCoordinates[1].index];
        } else if (minDistanceIndex === distancesFromCoordinates.length - 1) {
            interpolated = interpolate(
                distancesFromCoordinates[minDistanceIndex],
                distancesFromCoordinates[minDistanceIndex - 1],
                coordinates,
                interpolationIteration,
            );
            between = [
                distancesFromCoordinates[minDistanceIndex - 1].index,
                distancesFromCoordinates[minDistanceIndex].index,
            ];
        } else {
            if (
                distancesFromCoordinates[minDistanceIndex - 1].distance <
                distancesFromCoordinates[minDistanceIndex + 1].distance
            ) {
                interpolated = interpolate(
                    distancesFromCoordinates[minDistanceIndex - 1],
                    distancesFromCoordinates[minDistanceIndex],
                    coordinates,
                    interpolationIteration,
                );
                between = [
                    distancesFromCoordinates[minDistanceIndex - 1].index,
                    distancesFromCoordinates[minDistanceIndex].index,
                ];
            } else {
                interpolated = interpolate(
                    distancesFromCoordinates[minDistanceIndex + 1],
                    distancesFromCoordinates[minDistanceIndex],
                    coordinates,
                    interpolationIteration,
                );
                between = [
                    distancesFromCoordinates[minDistanceIndex].index,
                    distancesFromCoordinates[minDistanceIndex + 1].index,
                ];
            }
        }
    }

    return { ...interpolated, between: between };
}

function findMinDistance(decodedShape, coordinates, startRadius, stepRadius, maxRadius) {
    let distancesFromCoordinates = [];
    let minDistance = { index: 0, distance: undefined };

    while (distancesFromCoordinates.length < 2 || startRadius < maxRadius) {
        distancesFromCoordinates = [];
        minDistance = { index: 0, distance: undefined };

        for (let i = 0; i < decodedShape.length; i++) {
            let distance =
                getDistanceFromLatLonInKm(
                    coordinates.lat,
                    coordinates.lng,
                    decodedShape[i][0],
                    decodedShape[i][1],
                ) * 1000;

            if (!minDistance.distance || distance < minDistance.distance) {
                minDistance.index = i;
                minDistance.lat = decodedShape[i][0];
                minDistance.lng = decodedShape[i][1];
                minDistance.distance = distance;
            }

            if (distance <= startRadius)
                distancesFromCoordinates.push({
                    index: i,
                    distance: distance,
                    lat: decodedShape[i][0],
                    lng: decodedShape[i][1],
                });
        }

        startRadius += stepRadius;
    }

    return {
        distancesFromCoordinates: distancesFromCoordinates,
        minDistance: minDistance,
    };
}

function interpolate(
    shapeCoordinates1,
    shapeCoordinates2,
    currentCoordinates,
    interpolationIteration,
) {
    let interpolatedShape = {
        lat: (shapeCoordinates2.lat + shapeCoordinates1.lat) / 2,
        lng: (shapeCoordinates2.lng + shapeCoordinates1.lng) / 2,
    };

    let distanceToInterpolated =
        getDistanceFromLatLonInKm(
            interpolatedShape.lat,
            interpolatedShape.lng,
            currentCoordinates.lat,
            currentCoordinates.lng,
        ) * 1000;

    if (interpolationIteration !== 0) {
        if (distanceToInterpolated < shapeCoordinates2.distance)
            return interpolate(
                {
                    distance: distanceToInterpolated,
                    lat: interpolatedShape.lat,
                    lng: interpolatedShape.lng,
                },
                shapeCoordinates1,
                currentCoordinates,
                interpolationIteration - 1,
            );
        else
            return interpolate(
                {
                    distance: distanceToInterpolated,
                    lat: interpolatedShape.lat,
                    lng: interpolatedShape.lng,
                },
                shapeCoordinates2,
                currentCoordinates,
                interpolationIteration - 1,
            );
    }

    let shapes = [
        shapeCoordinates1,
        shapeCoordinates2,
        {
            distance: distanceToInterpolated,
            lat: interpolatedShape.lat,
            lng: interpolatedShape.lng,
        },
    ];

    shapes.sort(function (a, b) {
        return a.distance - b.distance;
    });

    return shapes[0];
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
