import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination
  const options = {
    page: Number(page),
    limit: Number(limit),
  };
  const aggregateVideos = Video.aggregate([
    {
      $match: {
        $or: [
          { title: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $project: {
        _id: 1,
        title: 1,
        description: 1,
        thumbnail: 1,
        views: 1,
        duration: 1,
        createdAt: 1,
        updatedAt: 1,
        isPublished: 1,
        owner: {
          _id: "$owner._id",
          name: "$owner.name",
          avatar: "$owner.avatar",
        },
      },
    },
  ]);
  const videos = await Video.aggregatePaginate(aggregateVideos, options);
  if (!videos) {
    return res.status(404).json(new ApiError(404, "No videos found"));
  }
  return res.status(200).json(new ApiResponse(200, videos, "Videos fetched"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
  if (!title) {
    throw new ApiError(400, "Title and description are required");
  }
  if (!req.user && !req.user._id) {
    return res.status(401).json(new ApiError(401, "User is not authenticated"));
  }
  const videoLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!videoLocalPath && !thumbnailLocalPath) {
    throw new ApiError(400, "videoLocalPath Error: Video file is required");
  }
  const uploadedVideo = await uploadOnCloudinary(videoLocalPath);
  const uploadedVideoThumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!uploadedVideo && !uploadedVideoThumbnail) {
    throw new ApiError(400, "Video file and thumbnail is required");
  }
  const video = await Video.create({
    videoFile: uploadedVideo?.secure_url,
    thumbnail: uploadedVideoThumbnail?.secure_url,
    title,
    description: description || "",
    duration: uploadedVideo?.duration,
    isPublished: true,
    owner: req.user._id,
  });
  if (!video) {
    return res.status(400).json(new ApiError(400, "Video cannot be created"));
  }
  return res.status(201).json(new ApiResponse(201, video, "Video created"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!isValidObjectId(videoId)) {
    return res.status(400).json(new ApiError(400, "Invalid video ID"));
  }
  const video = await Video.findOne({ _id: videoId });
  if (!video) {
    return res.status(404).json(new ApiError(404, "Video not found"));
  }
  return res.status(200).json(new ApiResponse(200, video, "Video fetched"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  if (!isValidObjectId(videoId)) {
    return res.status(400).json(new ApiError(400, "Invalid video ID"));
  }
  if (!req.user || !req.user._id) {
    return res.status(401).json(new ApiError(401, "User is not authenticated"));
  }
  const videoExists = await Video.exists({ _id: videoId });
  if (!videoExists) {
    return res.status(404).json(new ApiError(404, "Video not found"));
  }
  const thumbnailLocalPath = req.file?.path;
  if (!thumbnailLocalPath) {
    throw new ApiError(
      400,
      "thumbnailLocalPath Error: Thumbnail file is required"
    );
  }
  const updateVideoThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  if (!updateVideoThumbnail) {
    throw new ApiError(400, "Video file and thumbnail is required");
  }
  const video = await Video.findOneAndUpdate(
    { _id: videoId },
    {
      $set: {
        thumbnail: updateVideoThumbnail?.secure_url,
        title: req.body?.title,
        description: req.body?.description,
        isPublished: req.body?.isPublished,
      },
    },
    { new: true }
  );
  if (!video) {
    return res.status(400).json(new ApiError(400, "Video cannot be updated"));
  }
  return res.status(200).json(new ApiResponse(200, video, "Video updated"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!isValidObjectId(videoId)) {
    return res.status(400).json(new ApiError(400, "Invalid video ID"));
  }
  if (!req.user || !req.user._id) {
    return res.status(401).json(new ApiError(401, "User is not authenticated"));
  }
  const videoExists = await Video.exists({ _id: videoId });
  if (!videoExists) {
    return res.status(404).json(new ApiError(404, "Video not found"));
  }
  const video = await Video.findOneAndDelete({ _id: videoId });
  if (!video) {
    return res.status(400).json(new ApiError(400, "Video cannot be deleted"));
  }
  return res.status(200).json(new ApiResponse(200, null, "Video deleted"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  try {
    const { videoId } = req.params;
    //TODO: toggle publish status
    if (!isValidObjectId(videoId)) {
      return res.status(400).json(new ApiError(400, "Invalid video ID"));
    }
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json(new ApiError(401, "User is not authenticated"));
    }
    const videoExists = await Video.exists({ _id: videoId });
    if (!videoExists) {
      return res.status(404).json(new ApiError(404, "Video not found"));
    }
    const video = await Video.findOneAndUpdate(
      { _id: videoId },
      [
        {
          $set: {
            isPublished: {
              $cond: [{ $eq: ["$isPublished", true] }, false, true],
            },
          },
        },
      ],
      { new: true }
    );
    if (!video) {
      return res.status(400).json(new ApiError(400, "Video cannot be updated"));
    }
    return res.status(200).json(new ApiResponse(200, video, "Video updated"));
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json(
        new ApiError(500, "Internal server error while video toggle publish")
      );
  }
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
