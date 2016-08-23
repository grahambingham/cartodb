# encoding utf-8

module Resque
  module TrackingJobs
    module SendSegmentEvent
      @queue = :tracker

      def self.perform(name, properties)
        return unless key = Cartodb.config[:segment]['api_key']

        segment = Segment::Analytics.new(write_key: key)
        segment.track(event: name, properties: properties)
        segment.flush
      rescue => exception
        CartoDB::Logger.warning(message: 'Can\'t report to Segment',
                                exception: exception,
                                event: name,
                                properties: properties)
      end
    end
  end
end
