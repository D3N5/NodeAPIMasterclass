const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const geocoder = require('../utils/geocoder');
const Bootcamp = require('../models/Bootcamp');

/**
 * @desc      Get all bootcamps
 * @route     GET /api/v1/bootcamps
 * @access    Public
 */
exports.getBootCamps = asyncHandler(async (req, res, next) => {
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Loop over removeFields and delete them from reqQuerry
  removeFields.forEach((param) => delete reqQuery[param]);

  // Create query string
  let queryString = JSON.stringify(reqQuery);

  // Search and replace for operators (gt, gte, lt...)
  queryString = queryString.replace(
    /\b(gt|gte|lt|lte|in)\b/g,
    (match) => `$${match}`,
  );

  // Finding ressources
  query = Bootcamp.find(JSON.parse(queryString)).populate('courses');

  // Select fields
  if (req.query.select) {
    const fields = req.query.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    // By default sort by DESC date
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Bootcamp.countDocuments();

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const bootcamps = await query;

  // Pagination result
  const pagination = {};
  if (endIndex < total) {
    pagination.next = {
      page: page + 1,
      limit,
    };
  }

  if (startIndex > 0) {
    pagination.prev = {
      page: page - 1,
      limit,
    };
  }

  res.status(200).json({
    success: true,
    count: bootcamps.length,
    pagination,
    data: bootcamps,
  });
});

/**
 * @desc      Get single bootcamp
 * @route     GET /api/v1/bootcamps/:id
 * @access    Public
 */
exports.getBootCamp = asyncHandler(async (req, res, next) => {
  const bootcamp = await Bootcamp.findById(req.params.id);

  if (!bootcamp) {
    return next(
      new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404),
    );
  }

  res.status(200).json({
    success: true,
    data: bootcamp,
  });
});

/**
 * @desc      Create new bootcamp
 * @route     POST /api/v1/bootcamps
 * @access    Private
 */
exports.createBootCamp = asyncHandler(async (req, res, next) => {
  const bootcamp = await Bootcamp.create(req.body);

  res.status(201).json({
    success: true,
    data: bootcamp,
  });
});

/**
 * @desc      Update bootcamp
 * @route     PUT /api/v1/bootcamps/:id
 * @access    Private
 */
exports.updateBootCamp = asyncHandler(async (req, res, next) => {
  const bootcamp = await Bootcamp.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!bootcamp) {
    return next(
      new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404),
    );
  }
  res.status(200).json({ success: true, data: bootcamp });
});

/**
 * @desc      Delete bootcamp
 * @route     DELETE /api/v1/bootcamps/:id
 * @access    Private
 */
exports.deleteBootCamp = asyncHandler(async (req, res, next) => {
  const bootcamp = await Bootcamp.findById(req.params.id);

  if (!bootcamp) {
    return next(
      new ErrorResponse(`Bootcamp not found with id of ${req.params.id}`, 404),
    );
  }

  bootcamp.remove();

  res.status(200).json({ success: true, data: {} });
});

/**
 * @desc      Get bootcamps within a radius (unit by default in mi. In km if specified)
 * @route     GET /api/v1/bootcamps/radius/:zipcode/:distance?unit=
 * @access    Private
 */
exports.getBootcampsInRadius = asyncHandler(async (req, res, next) => {
  const { zipcode, distance } = req.params;
  const { unit } = req.query;

  // Get lat & lng from geocoder
  const loc = await geocoder.geocode(zipcode);
  const lat = loc[0].latitude;
  const lng = loc[0].longitude;

  // Radius calculation using radians
  // Divide distance by radius of the Earth (3963 mi or 6378 km)
  let radius;
  if (!unit || unit === 'mi') {
    radius = distance / 3963;
  } else if (unit === 'km') {
    radius = distance / 6378;
  }

  const bootcamps = await Bootcamp.find({
    location: {
      $geoWithin: { $centerSphere: [[lng, lat], radius] },
    },
  });

  res.status(200).json({
    success: true,
    count: bootcamps.length,
    data: bootcamps,
  });
});
