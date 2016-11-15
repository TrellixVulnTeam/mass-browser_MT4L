// Copyright 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "core/layout/ng/ng_units.h"

#include "core/layout/ng/ng_writing_mode.h"

namespace blink {

NGPhysicalSize NGLogicalSize::ConvertToPhysical(NGWritingMode mode) const {
  return mode == HorizontalTopBottom ? NGPhysicalSize(inline_size, block_size)
                                     : NGPhysicalSize(block_size, inline_size);
}

bool NGLogicalSize::operator==(const NGLogicalSize& other) const {
  return std::tie(other.inline_size, other.block_size) ==
         std::tie(inline_size, block_size);
}

NGLogicalSize NGPhysicalSize::ConvertToLogical(NGWritingMode mode) const {
  return mode == HorizontalTopBottom ? NGLogicalSize(width, height)
                                     : NGLogicalSize(height, width);
}

bool NGLogicalRect::IsEmpty() const {
  // TODO(layout-dev): equality check shouldn't allocate an object each time.
  return *this == NGLogicalRect();
}

bool NGLogicalRect::IsContained(const NGLogicalRect& other) const {
  return !(InlineEndOffset() <= other.InlineStartOffset() ||
           BlockEndOffset() <= other.BlockStartOffset() ||
           InlineStartOffset() >= other.InlineEndOffset() ||
           BlockStartOffset() >= other.BlockEndOffset());
}

bool NGLogicalRect::operator==(const NGLogicalRect& other) const {
  return std::tie(other.offset, other.size) == std::tie(offset, size);
}

String NGLogicalRect::ToString() const {
  return String::format("%s,%s %sx%s",
                        offset.inline_offset.toString().ascii().data(),
                        offset.block_offset.toString().ascii().data(),
                        size.inline_size.toString().ascii().data(),
                        size.block_size.toString().ascii().data());
}

NGPhysicalOffset NGLogicalOffset::ConvertToPhysical(
    NGWritingMode mode,
    NGDirection direction,
    NGPhysicalSize container_size,
    NGPhysicalSize inner_size) const {
  switch (mode) {
    case HorizontalTopBottom:
      if (direction == LeftToRight)
        return NGPhysicalOffset(inline_offset, block_offset);
      else
        return NGPhysicalOffset(
            container_size.width - inline_offset - inner_size.width,
            block_offset);
    case VerticalRightLeft:
    case SidewaysRightLeft:
      if (direction == LeftToRight)
        return NGPhysicalOffset(
            container_size.width - block_offset - inner_size.width,
            inline_offset);
      else
        return NGPhysicalOffset(
            container_size.width - block_offset - inner_size.width,
            container_size.height - inline_offset - inner_size.height);
    case VerticalLeftRight:
      if (direction == LeftToRight)
        return NGPhysicalOffset(block_offset, inline_offset);
      else
        return NGPhysicalOffset(
            block_offset,
            container_size.height - inline_offset - inner_size.height);
    case SidewaysLeftRight:
      if (direction == LeftToRight)
        return NGPhysicalOffset(
            block_offset,
            container_size.height - inline_offset - inner_size.height);
      else
        return NGPhysicalOffset(block_offset, inline_offset);
    default:
      ASSERT_NOT_REACHED();
      return NGPhysicalOffset();
  }
}

bool NGLogicalOffset::operator==(const NGLogicalOffset& other) const {
  return std::tie(other.inline_offset, other.block_offset) ==
         std::tie(inline_offset, block_offset);
}

NGLogicalOffset NGLogicalOffset::operator+(const NGLogicalOffset& other) const {
  NGLogicalOffset result;
  result.inline_offset = this->inline_offset + other.inline_offset;
  result.block_offset = this->block_offset + other.block_offset;
  return result;
}

NGLogicalOffset& NGLogicalOffset::operator+=(const NGLogicalOffset& other) {
  *this = *this + other;
  return *this;
}

bool NGBoxStrut::IsEmpty() const {
  return *this == NGBoxStrut();
}

bool NGBoxStrut::operator==(const NGBoxStrut& other) const {
  return std::tie(other.inline_start, other.inline_end, other.block_start,
                  other.block_end) ==
         std::tie(inline_start, inline_end, block_start, block_end);
}

LayoutUnit NGMarginStrut::BlockEndSum() const {
  return margin_block_end + negative_margin_block_end;
}

void NGMarginStrut::AppendMarginBlockStart(const LayoutUnit& value) {
  if (value < 0) {
    negative_margin_block_start =
        -std::max(value.abs(), negative_margin_block_start.abs());
  } else {
    margin_block_start = std::max(value, margin_block_start);
  }
}

void NGMarginStrut::AppendMarginBlockEnd(const LayoutUnit& value) {
  if (value < 0) {
    negative_margin_block_end =
        -std::max(value.abs(), negative_margin_block_end.abs());
  } else {
    margin_block_end = std::max(value, margin_block_end);
  }
}

void NGMarginStrut::SetMarginBlockStart(const LayoutUnit& value) {
  if (value < 0) {
    negative_margin_block_start = value;
  } else {
    margin_block_start = value;
  }
}

void NGMarginStrut::SetMarginBlockEnd(const LayoutUnit& value) {
  if (value < 0) {
    negative_margin_block_end = value;
  } else {
    margin_block_end = value;
  }
}

String NGMarginStrut::ToString() const {
  return String::format("Start: (%d %d) End: (%d %d)",
                        margin_block_start.toInt(), margin_block_end.toInt(),
                        negative_margin_block_start.toInt(),
                        negative_margin_block_end.toInt());
}

bool NGMarginStrut::IsEmpty() const {
  return *this == NGMarginStrut();
}

bool NGMarginStrut::operator==(const NGMarginStrut& other) const {
  return std::tie(other.margin_block_start, other.margin_block_end,
                  other.negative_margin_block_start,
                  other.negative_margin_block_end) ==
         std::tie(margin_block_start, margin_block_end,
                  negative_margin_block_start, negative_margin_block_end);
}

}  // namespace blink